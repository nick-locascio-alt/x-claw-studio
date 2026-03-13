import { Type, GoogleGenAI } from "@google/genai";
import { setTimeout as delay } from "node:timers/promises";
import { getGeminiApiKey, loadEnv } from "@/src/lib/env";
import type {
  ExtractedTweet,
  TopicSignalKind,
  TweetTopicAnalysisRecord,
  TweetTopicSignal,
  TweetUsageRecord
} from "@/src/lib/types";

loadEnv();

export const topicAnalysisModel = process.env.GEMINI_TOPIC_MODEL || "gemini-2.5-flash-lite";
const topicAnalysisMaxRetries = Number(process.env.GEMINI_TOPIC_MAX_RETRIES || 4);
const topicAnalysisRetryBaseDelayMs = Number(process.env.GEMINI_TOPIC_RETRY_BASE_DELAY_MS || 5000);
const topicAnalysisRetryMaxDelayMs = Number(process.env.GEMINI_TOPIC_RETRY_MAX_DELAY_MS || 45000);

const topicAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    summary_label: { type: Type.STRING, nullable: true },
    is_news: { type: Type.BOOLEAN },
    news_peg: { type: Type.STRING, nullable: true },
    why_now: { type: Type.STRING, nullable: true },
    sentiment: {
      type: Type.STRING,
      enum: ["positive", "negative", "mixed", "neutral"]
    },
    stance: {
      type: Type.STRING,
      enum: ["supportive", "critical", "observational", "celebratory", "anxious", "curious", "mixed"]
    },
    emotional_tone: { type: Type.STRING, nullable: true },
    opinion_intensity: {
      type: Type.STRING,
      enum: ["low", "medium", "high"]
    },
    target_entity: { type: Type.STRING, nullable: true },
    confidence: { type: Type.NUMBER },
    signals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          kind: {
            type: Type.STRING,
            enum: ["entity", "cashtag", "hashtag", "phrase", "reference", "brand", "intent"]
          },
          confidence: { type: Type.NUMBER }
        },
        required: ["label", "kind", "confidence"]
      }
    }
  },
  required: [
    "summary_label",
    "is_news",
    "news_peg",
    "why_now",
    "sentiment",
    "stance",
    "emotional_tone",
    "opinion_intensity",
    "target_entity",
    "confidence",
    "signals"
  ]
} as const;

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
    topicAnalysisRetryMaxDelayMs,
    topicAnalysisRetryBaseDelayMs * Math.max(1, 2 ** Math.max(0, attempt - 1))
  );
  const jitter = Math.round(backoff * (0.2 + Math.random() * 0.3));
  return Math.min(topicAnalysisRetryMaxDelayMs, backoff + jitter);
}

function buildTweetKey(tweet: ExtractedTweet): string {
  return tweet.tweetId ?? `${tweet.sourceName}:${tweet.authorUsername ?? "unknown"}:${tweet.text ?? ""}`;
}

function normalizeSignalLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}

function coerceSignalKind(value: unknown): TopicSignalKind {
  return value === "entity" ||
    value === "cashtag" ||
    value === "hashtag" ||
    value === "phrase" ||
    value === "reference" ||
    value === "brand" ||
    value === "intent"
    ? value
    : "entity";
}

function buildTopicPrompt(tweet: ExtractedTweet, usages: TweetUsageRecord[]): string {
  const usageHints = usages
    .filter((usage) => usage.analysis.status === "complete")
    .slice(0, 2)
    .map((usage, index) => {
      const analysis = usage.analysis;
      return [
        `Usage hint ${index + 1}:`,
        `- brand_signals: ${analysis.brand_signals.join(", ") || "none"}`,
        `- reference_entity: ${analysis.reference_entity ?? "none"}`,
        `- reference_source: ${analysis.reference_source ?? "none"}`,
        `- cultural_reference: ${analysis.cultural_reference ?? "none"}`,
        `- analogy_target: ${analysis.analogy_target ?? "none"}`,
        `- search_keywords: ${analysis.search_keywords.join(", ") || "none"}`
      ].join("\n");
    })
    .join("\n\n");

  return [
    "Analyze this single tweet and extract the few most useful posting topics.",
    "Return only JSON matching the provided schema.",
    "The goal is editorial planning, not generic keyword extraction.",
    "Prefer 1 summary label and 2 to 4 supporting signals. Return empty signals only if the tweet is too vague to classify.",
    "Allowed signal kinds: entity, brand, reference, hashtag, cashtag, phrase, intent.",
    "Use concise labels, usually 2 to 6 words.",
    "Do not output pronouns, stopwords, filler fragments, or placeholders like N/A, none, null, this, that, just, going, really.",
    "Do not output full sentences as labels.",
    "A signal must be specific enough that multiple tweets could cluster under it.",
    "summary_label is the main topic we should group this tweet under. It should be more specific than a bare company or person name.",
    "Bad summary_label examples: Apple, AI, IDE, Meta.",
    "Good summary_label examples: Apple Software Decline, Agentic IDEs, Meta Roof Joke, Cloudflare /crawl API, Ben Affleck AI Film Deal, Qwen-3 In Orbit.",
    "Only use a bare company or person name if the tweet is truly about that subject in general and not about a narrower event, product, joke, or claim.",
    "If the tweet references a current event, product launch, company move, or public controversy, mark is_news=true.",
    "Capture how the tweet feels about the topic, not just what it mentions.",
    "sentiment should describe the overall polarity.",
    "stance should describe the tweet's posture toward the subject: supportive, critical, observational, celebratory, anxious, curious, or mixed.",
    "emotional_tone should be a short phrase like smug, excited, doomy, mocking, resigned, impressed, bitter, or playful.",
    "opinion_intensity should reflect how strongly the tweet pushes a feeling or judgment.",
    "target_entity should name the main company, person, product, or idea the opinion is about when there is one.",
    "summary_label should be the single best cluster label for this tweet, or null if none is strong.",
    "",
    `tweet_id: ${tweet.tweetId ?? "unknown"}`,
    `author_username: ${tweet.authorUsername ?? "unknown"}`,
    `created_at: ${tweet.createdAt ?? "unknown"}`,
    `tweet_text: ${tweet.text ?? ""}`,
    `likes: ${tweet.metrics.likes ?? "unknown"}`,
    `reposts: ${tweet.metrics.reposts ?? "unknown"}`,
    usageHints ? `\nSaved usage-analysis hints:\n${usageHints}` : ""
  ].join("\n");
}

export async function analyzeTweetTopicsWithGemini(input: {
  tweet: ExtractedTweet;
  usages: TweetUsageRecord[];
  analysisId: string;
}): Promise<TweetTopicAnalysisRecord> {
  const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  const prompt = buildTopicPrompt(input.tweet, input.usages);
  let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;

  for (let attempt = 1; attempt <= topicAnalysisMaxRetries + 1; attempt += 1) {
    try {
      response = await ai.models.generateContent({
        model: topicAnalysisModel,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: topicAnalysisSchema
        }
      });
      break;
    } catch (error) {
      if (!isRetryableGeminiError(error) || attempt > topicAnalysisMaxRetries) {
        throw error;
      }

      const retryDelayMs = computeRetryDelayMs(attempt);
      console.warn(
        `Gemini topic analysis transient failure for ${input.analysisId} on attempt ${attempt}/${topicAnalysisMaxRetries + 1}. Retrying in ${retryDelayMs}ms. ${getErrorMessage(error)}`
      );
      await delay(retryDelayMs);
    }
  }

  if (!response?.text) {
    throw new Error("Gemini topic analysis returned an empty response");
  }

  const parsed = JSON.parse(response.text) as {
    summary_label?: unknown;
    is_news?: unknown;
    news_peg?: unknown;
    why_now?: unknown;
    sentiment?: unknown;
    stance?: unknown;
    emotional_tone?: unknown;
    opinion_intensity?: unknown;
    target_entity?: unknown;
    confidence?: unknown;
    signals?: unknown;
  };

  const signalsRaw = Array.isArray(parsed.signals) ? parsed.signals : [];
  const signals: TweetTopicSignal[] = signalsRaw
    .filter((value): value is { label?: unknown; kind?: unknown; confidence?: unknown } => typeof value === "object" && value !== null)
    .map((value) => ({
      label: normalizeSignalLabel(typeof value.label === "string" ? value.label : ""),
      kind: coerceSignalKind(value.kind),
      confidence:
        typeof value.confidence === "number" && Number.isFinite(value.confidence)
          ? Math.max(0, Math.min(1, value.confidence))
          : 0.5
    }))
    .filter((signal) => signal.label.length >= 2)
    .slice(0, 4)
    .map((signal) => ({
      ...signal,
      key: `${signal.kind}:${signal.label.toLowerCase()}`,
      source: "llm_topic" as const
    }));

  return {
    analysisId: input.analysisId,
    tweetKey: buildTweetKey(input.tweet),
    tweetId: input.tweet.tweetId,
    authorUsername: input.tweet.authorUsername,
    createdAt: input.tweet.createdAt,
    text: input.tweet.text,
    usageIds: input.usages.map((usage) => usage.usageId),
    summaryLabel:
      typeof parsed.summary_label === "string" && parsed.summary_label.trim()
        ? normalizeSignalLabel(parsed.summary_label)
        : null,
    isNews: parsed.is_news === true,
    newsPeg: typeof parsed.news_peg === "string" && parsed.news_peg.trim() ? normalizeSignalLabel(parsed.news_peg) : null,
    whyNow: typeof parsed.why_now === "string" && parsed.why_now.trim() ? parsed.why_now.trim() : null,
    sentiment:
      parsed.sentiment === "positive" || parsed.sentiment === "negative" || parsed.sentiment === "mixed" || parsed.sentiment === "neutral"
        ? parsed.sentiment
        : "neutral",
    stance:
      parsed.stance === "supportive" ||
      parsed.stance === "critical" ||
      parsed.stance === "observational" ||
      parsed.stance === "celebratory" ||
      parsed.stance === "anxious" ||
      parsed.stance === "curious" ||
      parsed.stance === "mixed"
        ? parsed.stance
        : "observational",
    emotionalTone:
      typeof parsed.emotional_tone === "string" && parsed.emotional_tone.trim()
        ? normalizeSignalLabel(parsed.emotional_tone)
        : null,
    opinionIntensity:
      parsed.opinion_intensity === "low" || parsed.opinion_intensity === "medium" || parsed.opinion_intensity === "high"
        ? parsed.opinion_intensity
        : "medium",
    targetEntity:
      typeof parsed.target_entity === "string" && parsed.target_entity.trim()
        ? normalizeSignalLabel(parsed.target_entity)
        : null,
    confidence:
      typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.5,
    signals,
    analyzedAt: new Date().toISOString(),
    model: topicAnalysisModel
  };
}
