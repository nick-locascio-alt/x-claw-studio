import { createPartFromBase64, GoogleGenAI } from "@google/genai";
import { setTimeout as delay } from "node:timers/promises";
import { usageAnalysisSchema, usageAnalysisJsonSchema } from "@/src/lib/analysis-schema";
import { getGeminiApiKey, loadEnv } from "@/src/lib/env";
import { buildUsageId } from "@/src/lib/usage-id";
import { loadMediaAsBase64 } from "@/src/server/media-loader";
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

function buildPrompt(tweet: ExtractedTweet, mediaIndex: number): string {
  const media = tweet.media[mediaIndex];

  return [
    "Analyze this single X/Twitter tweet media usage.",
    "Return only JSON matching the provided schema.",
    "Use concise but information-dense values.",
    "All field names must remain exactly as provided.",
    "If a field is uncertain, provide the best grounded inference and explain uncertainty in confidence_notes.",
    "",
    `usageId: ${buildUsageId(tweet, mediaIndex)}`,
    `tweetId: ${tweet.tweetId ?? "unknown"}`,
    `author_username: ${tweet.authorUsername ?? "unknown"}`,
    `author_display_name: ${tweet.authorDisplayName ?? "unknown"}`,
    `tweet_url: ${tweet.tweetUrl ?? "unknown"}`,
    `created_at: ${tweet.createdAt ?? "unknown"}`,
    `tweet_text: ${tweet.text ?? ""}`,
    `likes: ${tweet.metrics.likes ?? "unknown"}`,
    `reposts: ${tweet.metrics.reposts ?? "unknown"}`,
    `replies: ${tweet.metrics.replies ?? "unknown"}`,
    `views: ${tweet.metrics.views ?? "unknown"}`,
    `media_kind: ${media.mediaKind}`,
    `media_source_url: ${media.sourceUrl ?? "unknown"}`,
    `media_poster_url: ${media.posterUrl ?? "unknown"}`,
    "",
    "Facet guidance:",
    "- has_celebrity: true if the media clearly contains a widely recognizable public figure or celebrity; false otherwise.",
    "- has_human_face: true if one or more human faces are visibly present; false otherwise.",
    "- features_female: true if a prominent depicted person appears female-presenting; false otherwise. This may coexist with features_male in group shots.",
    "- features_male: true if a prominent depicted person appears male-presenting; false otherwise. This may coexist with features_female in group shots.",
    "- has_screenshot_ui: true if the media is mainly a screenshot of software, a webpage, a terminal, a dashboard, or app UI; false otherwise.",
    "- has_text_overlay: true if there is prominent text rendered inside the media itself, beyond tiny incidental text; false otherwise.",
    "- has_chart_or_graph: true if a chart, graph, market candle chart, axis plot, or diagram is a major visual element; false otherwise.",
    "- has_logo_or_watermark: true if a logo, brand mark, or watermark is visibly embedded in the media; false otherwise.",
    "- caption_brief: literal one-sentence caption of the media.",
    "- scene_description: fuller visual description.",
    "- primary_emotion: the single dominant emotion the media conveys most strongly, like anxiety, awe, excitement, humor, confidence, dread, curiosity, or calm.",
    "- conveys: what social/emotional message the post communicates.",
    "- user_intent: why the author likely chose this media here.",
    "- rhetorical_role: reaction, evidence, explainer, meme, flex, announcement, fear signal, etc.",
    "- text_media_relationship: how the tweet text and media reinforce, contrast, or reframe each other.",
    "- metaphor: implied analogy or symbolic pairing between media and text.",
    "- trend_signal: why this media could travel or get reused.",
    "- reuse_pattern: how other posters might reuse the same asset archetype.",
    "- search_keywords: short retrieval-oriented keywords, not full sentences."
  ].join("\n");
}

export async function analyzeTweetMediaUsage(
  tweet: ExtractedTweet,
  mediaIndex = 0
): Promise<UsageAnalysis> {
  const apiKey = getGeminiApiKey();
  const media = tweet.media[mediaIndex];

  if (!media) {
    throw new Error(`Tweet ${tweet.tweetId ?? tweet.sourceName} has no media at index ${mediaIndex}`);
  }

  const mediaSource = media.posterUrl || media.previewUrl || media.sourceUrl;
  if (!mediaSource || mediaSource.startsWith("blob:")) {
    throw new Error("Media source is not analyzable yet; need poster URL or downloadable media URL");
  }

  const ai = new GoogleGenAI({ apiKey });
  const mediaPart = await loadMediaAsBase64(mediaSource);
  let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;

  for (let attempt = 1; attempt <= analysisMaxRetries + 1; attempt += 1) {
    try {
      response = await ai.models.generateContent({
        model: analysisModel,
        contents: [
          { text: buildPrompt(tweet, mediaIndex) },
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
