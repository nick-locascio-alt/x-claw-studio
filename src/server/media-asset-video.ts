import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createPartFromBase64, GoogleGenAI } from "@google/genai";
import ffmpegPath from "ffmpeg-static";
import { setTimeout as delay } from "node:timers/promises";
import { normalizeUsageAnalysis, usageAnalysisSchema, usageAnalysisJsonSchema } from "@/src/lib/analysis-schema";
import { ensureDir, writeJson } from "@/src/lib/fs";
import { getGeminiApiKey, loadEnv } from "@/src/lib/env";
import { buildVideoAssetAnalysisPrompt } from "@/src/server/gemini-analysis-prompt";
import { loadMediaAsBase64 } from "@/src/server/media-loader";
import { indexAssetVideoAnalysisInChroma } from "@/src/server/chroma-facets";
import type { MediaAssetRecord, TweetUsageRecord, UsageAnalysis } from "@/src/lib/types";

loadEnv();

const execFileAsync = promisify(execFile);

const projectRoot = process.cwd();
const assetVideoDir = path.join(projectRoot, "data", "analysis", "media-assets", "videos");
const assetVideoAnalysisDir = path.join(projectRoot, "data", "analysis", "media-assets", "video-analyses");
const analysisModel = process.env.GEMINI_VIDEO_ANALYSIS_MODEL || process.env.GEMINI_ANALYSIS_MODEL || "gemini-3.1-flash-lite-preview";
const analysisMaxRetries = Number(process.env.GEMINI_ANALYSIS_MAX_RETRIES || 4);
const analysisRetryBaseDelayMs = Number(process.env.GEMINI_ANALYSIS_RETRY_BASE_DELAY_MS || 5000);
const analysisRetryMaxDelayMs = Number(process.env.GEMINI_ANALYSIS_RETRY_MAX_DELAY_MS || 45000);
const MIN_PROMOTED_VIDEO_BYTES = 4096;
const MAX_ANALYZABLE_VIDEO_DURATION_SECONDS = 5 * 60;
const HLS_MASTER_MIME = "application/x-mpegURL";

interface HlsStreamVariant {
  bandwidth: number;
  resolutionPixels: number;
  audioGroupId: string | null;
  url: string;
}

interface HlsAudioVariant {
  groupId: string;
  url: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isRetryableGeminiError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return (
    message.includes('"status":"INTERNAL"') ||
    message.includes('"code":500') ||
    message.includes("500") ||
    message.includes("Internal error encountered") ||
    message.includes('"status":"UNAVAILABLE"') ||
    message.includes('"code":503') ||
    message.includes("503") ||
    message.includes("high demand") ||
    message.includes("rate limit") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("429") ||
    message.includes("temporarily unavailable")
  );
}

function computeRetryDelayMs(attempt: number): number {
  const backoff = Math.min(
    analysisRetryMaxDelayMs,
    analysisRetryBaseDelayMs * Math.max(1, 2 ** Math.max(0, attempt - 1))
  );
  const jitter = Math.round(backoff * (0.2 + Math.random() * 0.3));
  return Math.min(analysisRetryMaxDelayMs, backoff + jitter);
}

export function parseFfmpegDurationSeconds(output: string): number | null {
  const match = output.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (![hours, minutes, seconds].every(Number.isFinite)) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

export async function getLocalVideoDurationSeconds(filePath: string): Promise<number | null> {
  if (!ffmpegPath) {
    return null;
  }

  try {
    await execFileAsync(ffmpegPath, ["-i", filePath], {
      env: process.env
    });
    return null;
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr ?? "") : "";
    const stdout = error && typeof error === "object" && "stdout" in error ? String(error.stdout ?? "") : "";
    return parseFfmpegDurationSeconds(`${stdout}\n${stderr}`);
  }
}

export async function assertVideoWithinAnalysisLimit(filePath: string, label: string): Promise<void> {
  const durationSeconds = await getLocalVideoDurationSeconds(filePath);
  if (durationSeconds !== null && durationSeconds > MAX_ANALYZABLE_VIDEO_DURATION_SECONDS) {
    throw new Error(
      `Refusing to analyze ${label}: duration ${durationSeconds.toFixed(1)}s exceeds ${MAX_ANALYZABLE_VIDEO_DURATION_SECONDS}s limit`
    );
  }
}

function getAssetVideoAnalysisPath(assetId: string): string {
  return path.join(assetVideoAnalysisDir, `${assetId}.json`);
}

export function readAssetVideoAnalysis(assetId: string): UsageAnalysis | null {
  const filePath = getAssetVideoAnalysisPath(assetId);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return normalizeUsageAnalysis(JSON.parse(fs.readFileSync(filePath, "utf8")) as UsageAnalysis);
}

export function readAllAssetVideoAnalyses(): UsageAnalysis[] {
  if (!fs.existsSync(assetVideoAnalysisDir)) {
    return [];
  }

  return fs
    .readdirSync(assetVideoAnalysisDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) =>
      normalizeUsageAnalysis(JSON.parse(fs.readFileSync(path.join(assetVideoAnalysisDir, fileName), "utf8")) as UsageAnalysis)
    );
}

function writeAssetVideoAnalysis(analysis: UsageAnalysis): string {
  const filePath = getAssetVideoAnalysisPath(analysis.usageId.replace("::video", ""));
  ensureDir(path.dirname(filePath));
  writeJson(filePath, normalizeUsageAnalysis(analysis));
  return filePath;
}

export function materializeUsageAnalysisFromAssetVideo(
  videoAnalysis: UsageAnalysis,
  usage: Pick<TweetUsageRecord, "usageId" | "mediaIndex" | "tweet"> | { usageId: string; mediaIndex: number; tweet: TweetUsageRecord["tweet"] }
): UsageAnalysis {
  const media = usage.tweet.media[usage.mediaIndex];
  const existingUsageNotes = videoAnalysis.usage_notes ? [videoAnalysis.usage_notes] : [];

  return normalizeUsageAnalysis({
    ...videoAnalysis,
    usageId: usage.usageId,
    tweetId: usage.tweet.tweetId,
    mediaIndex: usage.mediaIndex,
    mediaKind: media?.mediaKind ?? videoAnalysis.mediaKind,
    usage_notes: [...existingUsageNotes, "Derived from promoted asset video analysis."].join(" ")
  });
}

export function choosePromotableVideoUrl(asset: MediaAssetRecord): string | null {
  const preferredVideoMp4 = asset.sourceUrls.find(
    (url) =>
      /^https:\/\/video\.twimg\.com\/.*\/vid\/.*\.mp4(?:\?|$)/.test(url) &&
      !/\/0\/0\//.test(url)
  );
  if (preferredVideoMp4) {
    return preferredVideoMp4;
  }

  const fallbackVideoMp4 = asset.sourceUrls.find(
    (url) =>
      /^https:\/\/video\.twimg\.com\/.*\.mp4(?:\?|$)/.test(url) &&
      !/\/aud\//.test(url) &&
      !/\/0\/0\//.test(url)
  );
  if (fallbackVideoMp4) {
    return fallbackVideoMp4;
  }

  return null;
}

export function choosePromotableHlsMasterUrl(asset: MediaAssetRecord): string | null {
  return (
    asset.sourceUrls.find(
      (url) =>
        /^https:\/\/video\.twimg\.com\/.*\.m3u8(?:\?|$)/.test(url) &&
        !/\/pl\/avc1\//.test(url) &&
        !/\/pl\/mp4a\//.test(url)
    ) ?? null
  );
}

export function listPromotableVideoSources(asset: MediaAssetRecord): string[] {
  const candidates = [
    asset.promotedVideoSourceUrl &&
    (choosePromotableVideoUrl({ ...asset, sourceUrls: [asset.promotedVideoSourceUrl] }) ||
      choosePromotableHlsMasterUrl({ ...asset, sourceUrls: [asset.promotedVideoSourceUrl] }))
      ? asset.promotedVideoSourceUrl
      : null,
    choosePromotableVideoUrl(asset),
    choosePromotableHlsMasterUrl(asset)
  ];

  return Array.from(new Set(candidates.filter((value): value is string => Boolean(value))));
}

function parseAttributeMap(line: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const payload = line.slice(line.indexOf(":") + 1);
  const pattern = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g;

  for (const match of payload.matchAll(pattern)) {
    const key = match[1];
    const rawValue = match[2] ?? "";
    attributes[key] = rawValue.startsWith("\"") && rawValue.endsWith("\"") ? rawValue.slice(1, -1) : rawValue;
  }

  return attributes;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download playlist: ${response.status} ${response.statusText} for ${url}`);
  }

  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("mpegurl") && !contentType.includes("application/vnd.apple.mpegurl") && !contentType.includes("text/plain")) {
    throw new Error(`Expected HLS playlist response for ${url}, received ${contentType || "unknown content-type"}`);
  }

  return response.text();
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download media segment: ${response.status} ${response.statusText} for ${url}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function parseMasterPlaylist(masterUrl: string, contents: string): {
  audioVariants: HlsAudioVariant[];
  streamVariants: HlsStreamVariant[];
} {
  const lines = contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const audioVariants: HlsAudioVariant[] = [];
  const streamVariants: HlsStreamVariant[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }

    if (line.startsWith("#EXT-X-MEDIA:")) {
      const attributes = parseAttributeMap(line);
      if (attributes.TYPE === "AUDIO" && attributes["GROUP-ID"] && attributes.URI) {
        audioVariants.push({
          groupId: attributes["GROUP-ID"],
          url: new URL(attributes.URI, masterUrl).toString()
        });
      }
      continue;
    }

    if (line.startsWith("#EXT-X-STREAM-INF:")) {
      const attributes = parseAttributeMap(line);
      const nextLine = lines[index + 1];
      if (!nextLine || nextLine.startsWith("#")) {
        continue;
      }

      const [width, height] = (attributes.RESOLUTION ?? "0x0").split("x").map((value) => Number(value) || 0);
      streamVariants.push({
        bandwidth: Number(attributes["AVERAGE-BANDWIDTH"] ?? attributes.BANDWIDTH ?? 0) || 0,
        resolutionPixels: width * height,
        audioGroupId: attributes.AUDIO ?? null,
        url: new URL(nextLine, masterUrl).toString()
      });
      index += 1;
    }
  }

  return { audioVariants, streamVariants };
}

function chooseBestHlsVariant(variants: HlsStreamVariant[]): HlsStreamVariant | null {
  return (
    [...variants].sort((left, right) => {
      if (right.resolutionPixels !== left.resolutionPixels) {
        return right.resolutionPixels - left.resolutionPixels;
      }

      return right.bandwidth - left.bandwidth;
    })[0] ?? null
  );
}

async function downloadHlsPlaylistBundle(asset: MediaAssetRecord, masterUrl: string): Promise<string> {
  const bundleDir = path.join(assetVideoDir, asset.assetId);
  ensureDir(bundleDir);

  const masterContents = await fetchText(masterUrl);
  const { audioVariants, streamVariants } = parseMasterPlaylist(masterUrl, masterContents);
  const selectedStream = chooseBestHlsVariant(streamVariants);

  if (!selectedStream) {
    throw new Error(`No playable HLS variants found for ${masterUrl}`);
  }

  const selectedAudio =
    (selectedStream.audioGroupId && audioVariants.find((variant) => variant.groupId === selectedStream.audioGroupId)) ?? null;

  const localVideoPlaylist = await downloadMediaPlaylist({
    playlistUrl: selectedStream.url,
    bundleDir,
    playlistFileName: "video.m3u8",
    segmentPrefix: "video"
  });
  const localAudioPlaylist = selectedAudio
    ? await downloadMediaPlaylist({
        playlistUrl: selectedAudio.url,
        bundleDir,
        playlistFileName: "audio.m3u8",
        segmentPrefix: "audio"
      })
    : null;

  const masterLines = ["#EXTM3U", "#EXT-X-VERSION:6", "#EXT-X-INDEPENDENT-SEGMENTS"];
  if (localAudioPlaylist) {
    masterLines.push('#EXT-X-MEDIA:NAME="Audio",TYPE=AUDIO,GROUP-ID="audio",AUTOSELECT=YES,URI="audio.m3u8"');
  }

  const codecs = localAudioPlaylist ? 'CODECS="mp4a.40.2,avc1.640032",AUDIO="audio"' : 'CODECS="avc1.640032"';
  masterLines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${Math.max(selectedStream.bandwidth, 1)},${codecs}`);
  masterLines.push(localVideoPlaylist);

  fs.writeFileSync(path.join(bundleDir, "master.m3u8"), `${masterLines.join("\n")}\n`);
  return path.relative(projectRoot, path.join(bundleDir, "master.m3u8"));
}

async function remuxHlsBundleToMp4(input: {
  assetId: string;
  playlistRelativePath: string;
}): Promise<string | null> {
  if (!ffmpegPath) {
    return null;
  }

  const inputPath = path.join(projectRoot, input.playlistRelativePath);
  const outputPath = path.join(assetVideoDir, `${input.assetId}.mp4`);

  await execFileAsync(
    ffmpegPath,
    [
      "-y",
      "-protocol_whitelist",
      "file,crypto,data",
      "-i",
      inputPath,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      outputPath
    ],
    {
      cwd: path.dirname(inputPath),
      env: process.env
    }
  );

  return isValidPromotedVideoFile(outputPath) ? path.relative(projectRoot, outputPath) : null;
}

function removeTemporaryHlsBundle(playlistRelativePath: string): void {
  const absolutePlaylistPath = path.join(projectRoot, playlistRelativePath);
  const bundleDir = path.dirname(absolutePlaylistPath);

  if (!bundleDir.startsWith(`${assetVideoDir}${path.sep}`)) {
    return;
  }

  if (fs.existsSync(bundleDir)) {
    fs.rmSync(bundleDir, { recursive: true, force: true });
  }
}

async function downloadMediaPlaylist(input: {
  playlistUrl: string;
  bundleDir: string;
  playlistFileName: string;
  segmentPrefix: string;
}): Promise<string> {
  const contents = await fetchText(input.playlistUrl);
  const lines = contents.split(/\r?\n/);
  const rewrittenLines: string[] = [];
  let segmentIndex = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      rewrittenLines.push("");
      continue;
    }

    if (line.startsWith("#EXT-X-MAP:")) {
      const attributes = parseAttributeMap(line);
      const sourceUrl = attributes.URI ? new URL(attributes.URI, input.playlistUrl).toString() : null;
      if (!sourceUrl) {
        rewrittenLines.push(line);
        continue;
      }

      const extension = path.extname(new URL(sourceUrl).pathname) || ".mp4";
      const localFileName = `${input.segmentPrefix}-init${extension}`;
      fs.writeFileSync(path.join(input.bundleDir, localFileName), await fetchBuffer(sourceUrl));
      rewrittenLines.push(`#EXT-X-MAP:URI="${localFileName}"`);
      continue;
    }

    if (!line.startsWith("#")) {
      const sourceUrl = new URL(line, input.playlistUrl).toString();
      const extension = path.extname(new URL(sourceUrl).pathname) || ".m4s";
      const localFileName = `${input.segmentPrefix}-${String(segmentIndex).padStart(4, "0")}${extension}`;
      fs.writeFileSync(path.join(input.bundleDir, localFileName), await fetchBuffer(sourceUrl));
      rewrittenLines.push(localFileName);
      segmentIndex += 1;
      continue;
    }

    rewrittenLines.push(line);
  }

  fs.writeFileSync(path.join(input.bundleDir, input.playlistFileName), `${rewrittenLines.join("\n")}\n`);
  return input.playlistFileName;
}

function isValidPromotedVideoFile(filePath: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    return false;
  }

  if (filePath.endsWith(".m3u8")) {
    return stat.size > 0;
  }

  return stat.size >= MIN_PROMOTED_VIDEO_BYTES;
}

async function downloadPromotedVideo(asset: MediaAssetRecord, url: string): Promise<string> {
  ensureDir(assetVideoDir);
  const extension = path.extname(new URL(url).pathname) || ".mp4";
  const filePath = path.join(assetVideoDir, `${asset.assetId}${extension}`);
  if (!isValidPromotedVideoFile(filePath)) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download promoted video: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength < MIN_PROMOTED_VIDEO_BYTES) {
      throw new Error(`Downloaded promoted video is too small to be playable: ${buffer.byteLength} bytes from ${url}`);
    }

    fs.writeFileSync(filePath, buffer);
  }

  return path.relative(projectRoot, filePath);
}

export async function promoteMediaAssetVideo(asset: MediaAssetRecord): Promise<MediaAssetRecord> {
  if (!["video", "video_hls", "video_blob"].includes(asset.mediaKind)) {
    return asset;
  }

  const promotableSources = listPromotableVideoSources(asset);
  if (promotableSources.length === 0) {
    return asset;
  }

  const existingVideoFilePath =
    asset.promotedVideoFilePath && isValidPromotedVideoFile(path.join(projectRoot, asset.promotedVideoFilePath))
      ? asset.promotedVideoFilePath
      : null;
  if (existingVideoFilePath) {
    return {
      ...asset,
      promotedVideoSourceUrl: asset.promotedVideoSourceUrl ?? promotableSources[0],
      promotedVideoFilePath: existingVideoFilePath
    };
  }

  let lastError: unknown = null;

  for (const promotedVideoSourceUrl of promotableSources) {
    try {
      const shouldUseHls =
        promotedVideoSourceUrl.includes(".m3u8") ||
        ((await fetch(promotedVideoSourceUrl, { method: "HEAD" })).headers.get("content-type") ?? "")
          .toLowerCase()
          .includes(HLS_MASTER_MIME.toLowerCase());

      let promotedVideoFilePath: string;
      if (shouldUseHls) {
        const playlistRelativePath = await downloadHlsPlaylistBundle(asset, promotedVideoSourceUrl);
        const remuxedVideoRelativePath = await remuxHlsBundleToMp4({
          assetId: asset.assetId,
          playlistRelativePath
        });

        if (remuxedVideoRelativePath) {
          removeTemporaryHlsBundle(playlistRelativePath);
          promotedVideoFilePath = remuxedVideoRelativePath;
        } else {
          promotedVideoFilePath = playlistRelativePath;
        }
      } else {
        promotedVideoFilePath = await downloadPromotedVideo(asset, promotedVideoSourceUrl);
      }

      return {
        ...asset,
        promotedVideoSourceUrl,
        promotedVideoFilePath
      };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return asset;
}

export async function analyzeMediaAssetVideo(
  asset: MediaAssetRecord,
  representativeUsage: TweetUsageRecord | null
): Promise<UsageAnalysis | null> {
  if (!asset.promotedVideoFilePath) {
    return null;
  }

  if (asset.promotedVideoFilePath.endsWith(".m3u8")) {
    return null;
  }

  const absoluteVideoPath = path.join(projectRoot, asset.promotedVideoFilePath);
  await assertVideoWithinAnalysisLimit(absoluteVideoPath, `asset video ${asset.assetId}`);

  const existing = readAssetVideoAnalysis(asset.assetId);
  if (existing?.status === "complete") {
    return existing;
  }

  const apiKey = getGeminiApiKey();
  const ai = new GoogleGenAI({ apiKey });
  const mediaPart = await loadMediaAsBase64(absoluteVideoPath);
  let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;

  for (let attempt = 1; attempt <= analysisMaxRetries + 1; attempt += 1) {
    try {
      response = await ai.models.generateContent({
        model: analysisModel,
        contents: [
          {
            text: buildVideoAssetAnalysisPrompt({
              assetId: asset.assetId,
              mediaKind: asset.mediaKind,
              canonicalMediaUrl: asset.canonicalMediaUrl,
              canonicalPosterUrl: asset.posterUrls[0] ?? null,
              representativeUsageId: representativeUsage?.usageId ?? null,
              representativeAuthorUsername: representativeUsage?.tweet.authorUsername ?? null,
              representativeTweetText: representativeUsage?.tweet.text ?? null
            })
          },
          createPartFromBase64(mediaPart.base64, mediaPart.mimeType)
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: usageAnalysisJsonSchema
        }
      });
      break;
    } catch (error) {
      if (!isRetryableGeminiError(error) || attempt > analysisMaxRetries) {
        throw error;
      }

      const retryDelayMs = computeRetryDelayMs(attempt);
      console.warn(
        `Gemini transient failure for asset video ${asset.assetId} on attempt ${attempt}/${analysisMaxRetries + 1}. Retrying in ${retryDelayMs}ms. ${getErrorMessage(error)}`
      );
      await delay(retryDelayMs);
    }
  }

  if (!response?.text) {
    throw new Error(`Gemini returned an empty asset video analysis response for ${asset.assetId}`);
  }

  const parsed = usageAnalysisSchema.parse(JSON.parse(response.text));
  const analysis: UsageAnalysis = {
    ...parsed,
    usageId: `${asset.assetId}::video`,
    tweetId: representativeUsage?.tweet.tweetId ?? null,
    mediaIndex: 0,
    mediaKind:
      asset.mediaKind === "video_blob" || asset.mediaKind === "video_hls" || asset.mediaKind === "video_poster"
        ? "video"
        : asset.mediaKind
  };

  writeAssetVideoAnalysis(analysis);
  await indexAssetVideoAnalysisInChroma(asset, representativeUsage, analysis);
  return analysis;
}
