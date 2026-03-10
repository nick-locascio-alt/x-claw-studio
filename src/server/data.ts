import fs from "node:fs";
import path from "node:path";
import { buildUsageId } from "@/src/lib/usage-id";
import type {
  CrawlManifest,
  ExtractedTweet,
  MediaAssetRecord,
  RunHistoryEntry,
  SchedulerConfig,
  TweetUsageRecord,
  UsageAnalysis
} from "@/src/lib/types";
import { readRunHistory, readSchedulerConfig } from "@/src/server/run-control";
import { readAllUsageAnalyses } from "@/src/server/analysis-store";
import { buildPhashMatchMap, readMediaAssetIndex } from "@/src/server/media-assets";

export interface DashboardData {
  manifests: CrawlManifest[];
  schedulerConfig: SchedulerConfig;
  runHistory: RunHistoryEntry[];
  totalTweetCount: number;
  tweetUsages: TweetUsageRecord[];
}

const projectRoot = process.cwd();

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function loadCrawlManifests(): CrawlManifest[] {
  const rawDir = path.join(projectRoot, "data", "raw");
  if (!fs.existsSync(rawDir)) {
    return [];
  }

  return fs
    .readdirSync(rawDir)
    .map((runId) => path.join(rawDir, runId, "manifest.json"))
    .map((manifestPath) => readJsonFile<CrawlManifest>(manifestPath))
    .filter((value): value is CrawlManifest => Boolean(value))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

function buildPendingAnalyses(tweets: ExtractedTweet[]): DashboardData["tweetUsages"] {
  return tweets.flatMap((tweet) =>
    tweet.media.map((media, mediaIndex) => {
      const usageId = buildUsageId(tweet, mediaIndex);

      return {
        usageId,
        tweet,
        mediaIndex,
        analysis: {
          usageId,
          tweetId: tweet.tweetId,
          mediaIndex,
          mediaKind: media.mediaKind,
          status: "pending",
          has_celebrity: null,
          has_human_face: null,
          features_female: null,
          features_male: null,
          has_screenshot_ui: null,
          has_text_overlay: null,
          has_chart_or_graph: null,
          has_logo_or_watermark: null,
          caption_brief: null,
          scene_description: null,
          ocr_text: null,
          primary_subjects: [],
          secondary_subjects: [],
          visible_objects: [],
          setting_context: null,
          action_or_event: null,
          primary_emotion: null,
          emotional_tone: null,
          conveys: null,
          user_intent: null,
          rhetorical_role: null,
          text_media_relationship: null,
          metaphor: null,
          humor_mechanism: null,
          cultural_reference: null,
          meme_format: null,
          persuasion_strategy: null,
          brand_signals: [],
          trend_signal: null,
          reuse_pattern: null,
          why_it_works: null,
          audience_takeaway: null,
          search_keywords: [],
          confidence_notes: null,
          usage_notes: null
        },
        mediaAssetId: null,
        mediaLocalFilePath: null,
        mediaAssetStarred: false,
        mediaAssetUsageCount: 0,
        phashMatchCount: 0
      };
    })
  );
}

function buildAssetUsageCountMap(assets: MediaAssetRecord[] | undefined): Map<string, number> {
  return new Map((assets ?? []).map((asset) => [asset.assetId, asset.usageIds.length]));
}

export function getDashboardData(): DashboardData {
  const manifests = loadCrawlManifests();
  const schedulerConfig = readSchedulerConfig();
  const runHistory = readRunHistory();
  const savedAnalyses = readAllUsageAnalyses();
  const assetIndex = readMediaAssetIndex();
  const analysisMap = new Map(savedAnalyses.map((analysis) => [analysis.usageId, analysis]));
  const mergedTweets = manifests.flatMap((manifest) => manifest.capturedTweets);
  const tweetMap = new Map(
    mergedTweets.map((tweet) => [
      tweet.tweetId ?? `${tweet.sourceName}:${tweet.authorUsername ?? "unknown"}:${tweet.text ?? ""}`,
      tweet
    ])
  );
  const sourceTweets = Array.from(tweetMap.values());
  const tweetUsages = buildPendingAnalyses(sourceTweets).map((usage) => ({
    ...usage,
    analysis: analysisMap.get(buildUsageId(usage.tweet, usage.mediaIndex)) ?? usage.analysis,
    mediaAssetId: assetIndex?.usageToAssetId[usage.usageId] ?? null,
    mediaAssetUsageCount: 0,
    phashMatchCount: 0
  }));
  const assetUsageCountMap = buildAssetUsageCountMap(assetIndex?.assets);
  const assetLocalFilePathMap = new Map((assetIndex?.assets ?? []).map((asset) => [asset.assetId, asset.canonicalFilePath]));
  const assetStarredMap = new Map((assetIndex?.assets ?? []).map((asset) => [asset.assetId, asset.starred]));
  const phashMatchMap = assetIndex ? buildPhashMatchMap({ assets: assetIndex.assets, usages: tweetUsages }) : {};
  const enrichedUsages = tweetUsages.map((usage) => {
    const assetId = usage.mediaAssetId;
    return {
      ...usage,
      mediaLocalFilePath: assetId ? assetLocalFilePathMap.get(assetId) ?? null : null,
      mediaAssetStarred: assetId ? assetStarredMap.get(assetId) ?? false : false,
      mediaAssetUsageCount: assetId ? assetUsageCountMap.get(assetId) ?? 0 : 0,
      phashMatchCount: assetId ? phashMatchMap[assetId]?.length ?? 0 : 0
    };
  });

  return {
    manifests,
    schedulerConfig,
    runHistory,
    totalTweetCount: sourceTweets.length,
    tweetUsages: enrichedUsages
  };
}
