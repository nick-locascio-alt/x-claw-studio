import { createPartFromBase64, GoogleGenAI } from "@google/genai";
import { setTimeout as delay } from "node:timers/promises";
import { usageAnalysisSchema, usageAnalysisJsonSchema } from "@/src/lib/analysis-schema";
import { getGeminiApiKey, loadEnv } from "@/src/lib/env";
import { buildUsageId } from "@/src/lib/usage-id";
import { loadMediaAsBase64 } from "@/src/server/media-loader";
import {
  buildTweetMediaAnalysisPrompt,
  type GeminiAnalysisPromptVariant
} from "@/src/server/gemini-analysis-prompt";
import type { ExtractedTweet, UsageAnalysis } from "@/src/lib/types";

loadEnv();
const analysisModel = process.env.GEMINI_ANALYSIS_MODEL || "gemini-3.1-flash-lite-preview";
const analysisMaxRetries = Number(process.env.GEMINI_ANALYSIS_MAX_RETRIES || 4);
const analysisRetryBaseDelayMs = Number(process.env.GEMINI_ANALYSIS_RETRY_BASE_DELAY_MS || 5000);
const analysisRetryMaxDelayMs = Number(process.env.GEMINI_ANALYSIS_RETRY_MAX_DELAY_MS || 45000);

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

interface AnalyzeTweetMediaUsageOptions {
  mediaIndex?: number;
  mediaSourceOverride?: string;
  promptVariant?: GeminiAnalysisPromptVariant;
}

export async function analyzeTweetMediaUsageWithOptions(
  tweet: ExtractedTweet,
  options: AnalyzeTweetMediaUsageOptions = {}
): Promise<UsageAnalysis> {
  const mediaIndex = options.mediaIndex ?? 0;
  const promptVariant = options.promptVariant ?? "cultural_audit";
  const media = tweet.media[mediaIndex];

  if (!media) {
    throw new Error(`Tweet ${tweet.tweetId ?? tweet.sourceName} has no media at index ${mediaIndex}`);
  }

  const mediaSource = options.mediaSourceOverride || media.posterUrl || media.previewUrl || media.sourceUrl;
  if (!mediaSource || mediaSource.startsWith("blob:")) {
    throw new Error("Media source is not analyzable yet; need poster URL or downloadable media URL");
  }

  const apiKey = getGeminiApiKey();
  const ai = new GoogleGenAI({ apiKey });
  const mediaPart = await loadMediaAsBase64(mediaSource);
  const prompt = buildTweetMediaAnalysisPrompt(tweet, mediaIndex, promptVariant);
  let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;

  for (let attempt = 1; attempt <= analysisMaxRetries + 1; attempt += 1) {
    try {
      response = await ai.models.generateContent({
        model: analysisModel,
        contents: [{ text: prompt }, createPartFromBase64(mediaPart.base64, mediaPart.mimeType)],
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
        `Gemini transient failure for ${buildUsageId(tweet, mediaIndex)} on attempt ${attempt}/${analysisMaxRetries + 1}. Retrying in ${retryDelayMs}ms. ${getErrorMessage(error)}`
      );
      await delay(retryDelayMs);
    }
  }

  if (!response) {
    throw new Error("Gemini analysis failed before a response was produced");
  }

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty analysis response");
  }

  const parsed = usageAnalysisSchema.parse(JSON.parse(text));
  return {
    ...parsed,
    usageId: buildUsageId(tweet, mediaIndex),
    tweetId: tweet.tweetId,
    mediaIndex,
    mediaKind: media.mediaKind,
    status: "complete"
  };
}

export async function analyzeTweetMediaUsage(
  tweet: ExtractedTweet,
  mediaIndex = 0
): Promise<UsageAnalysis> {
  return analyzeTweetMediaUsageWithOptions(tweet, {
    mediaIndex,
    promptVariant: "cultural_audit"
  });
}
