import fs from "node:fs";
import path from "node:path";
import { ensureDir, writeJson } from "@/src/lib/fs";
import type {
  ExtractedTweet,
  TopicOpinionIntensity,
  TopicSentiment,
  TopicStance,
  TweetTopicAnalysisRecord
} from "@/src/lib/types";

const projectRoot = process.cwd();
const topicAnalysisDir = path.join(projectRoot, "data", "analysis", "topic-tweets");

function buildTweetKey(tweet: ExtractedTweet): string {
  return tweet.tweetId ?? `${tweet.sourceName}:${tweet.authorUsername ?? "unknown"}:${tweet.text ?? ""}`;
}

export function buildTopicAnalysisId(tweet: ExtractedTweet): string {
  return tweet.tweetId ?? Buffer.from(buildTweetKey(tweet)).toString("base64url");
}

export function getTopicAnalysisPath(analysisId: string): string {
  return path.join(topicAnalysisDir, `${analysisId}.json`);
}

export function writeTopicAnalysis(analysis: TweetTopicAnalysisRecord): string {
  const filePath = getTopicAnalysisPath(analysis.analysisId);
  ensureDir(path.dirname(filePath));
  writeJson(filePath, analysis);
  return filePath;
}

function coerceSentiment(value: unknown): TopicSentiment {
  return value === "positive" || value === "negative" || value === "mixed" || value === "neutral" ? value : "neutral";
}

function coerceStance(value: unknown): TopicStance {
  return value === "supportive" ||
    value === "critical" ||
    value === "observational" ||
    value === "celebratory" ||
    value === "anxious" ||
    value === "curious" ||
    value === "mixed"
    ? value
    : "observational";
}

function coerceOpinionIntensity(value: unknown): TopicOpinionIntensity {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function normalizeTopicAnalysisRecord(value: TweetTopicAnalysisRecord): TweetTopicAnalysisRecord {
  return {
    ...value,
    sentiment: coerceSentiment(value.sentiment),
    stance: coerceStance(value.stance),
    emotionalTone: typeof value.emotionalTone === "string" && value.emotionalTone.trim() ? value.emotionalTone.trim() : null,
    opinionIntensity: coerceOpinionIntensity(value.opinionIntensity),
    targetEntity: typeof value.targetEntity === "string" && value.targetEntity.trim() ? value.targetEntity.trim() : null
  };
}

export function readTopicAnalysis(analysisId: string): TweetTopicAnalysisRecord | null {
  const filePath = getTopicAnalysisPath(analysisId);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return normalizeTopicAnalysisRecord(JSON.parse(fs.readFileSync(filePath, "utf8")) as TweetTopicAnalysisRecord);
}

export function readAllTopicAnalyses(): TweetTopicAnalysisRecord[] {
  if (!fs.existsSync(topicAnalysisDir)) {
    return [];
  }

  return fs
    .readdirSync(topicAnalysisDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) =>
      normalizeTopicAnalysisRecord(
        JSON.parse(fs.readFileSync(path.join(topicAnalysisDir, fileName), "utf8")) as TweetTopicAnalysisRecord
      )
    )
    .sort((left, right) => left.analysisId.localeCompare(right.analysisId));
}
