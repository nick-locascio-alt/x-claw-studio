import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { setTimeout as delay } from "node:timers/promises";
import { getGeminiApiKey, loadEnv } from "@/src/lib/env";
import type { MediaSimilarityEmbedding } from "@/src/lib/types";

loadEnv();

const mediaEmbeddingModel = process.env.GEMINI_MEDIA_MATCH_MODEL || "gemini-embedding-2-preview";
const mediaEmbeddingDimensions = Number(process.env.GEMINI_MEDIA_MATCH_DIMENSIONS || 768);
const mediaEmbeddingTaskType = "SEMANTIC_SIMILARITY" as const;
const mediaEmbeddingMaxRetries = Number(process.env.GEMINI_MEDIA_MATCH_MAX_RETRIES || 3);
const mediaEmbeddingRetryBaseDelayMs = Number(process.env.GEMINI_MEDIA_MATCH_RETRY_BASE_DELAY_MS || 3000);
const mediaEmbeddingRetryMaxDelayMs = Number(process.env.GEMINI_MEDIA_MATCH_RETRY_MAX_DELAY_MS || 30000);

function getMimeType(filePath: string): string | null {
  switch (path.extname(filePath).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    default:
      return null;
  }
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
    mediaEmbeddingRetryMaxDelayMs,
    mediaEmbeddingRetryBaseDelayMs * Math.max(1, 2 ** Math.max(0, attempt - 1))
  );
  const jitter = Math.round(backoff * (0.2 + Math.random() * 0.3));
  return Math.min(mediaEmbeddingRetryMaxDelayMs, backoff + jitter);
}

export function normalizeEmbedding(values: number[]): number[] {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(magnitude) || magnitude <= 0) {
    return values;
  }

  return values.map((value) => value / magnitude);
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return Number.NEGATIVE_INFINITY;
  }

  let dot = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
  }

  return dot;
}

export async function computeImageEmbedding(filePath: string): Promise<MediaSimilarityEmbedding | null> {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const mimeType = getMimeType(filePath);
  if (!mimeType) {
    return null;
  }

  let apiKey: string;
  try {
    apiKey = getGeminiApiKey();
  } catch {
    return null;
  }

  const ai = new GoogleGenAI({ apiKey });
  const data = fs.readFileSync(filePath, { encoding: "base64" });

  for (let attempt = 1; attempt <= mediaEmbeddingMaxRetries + 1; attempt += 1) {
    try {
      const response = await ai.models.embedContent({
        model: mediaEmbeddingModel,
        contents: [
          {
            inlineData: {
              mimeType,
              data
            }
          }
        ],
        config: {
          taskType: mediaEmbeddingTaskType,
          outputDimensionality: mediaEmbeddingDimensions
        }
      });
      const values =
        response.embeddings?.find((embedding) => Array.isArray(embedding?.values) && embedding.values.length > 0)?.values ??
        (response as { embedding?: { values?: number[] } }).embedding?.values ??
        [];
      if (values.length === 0) {
        return null;
      }

      return {
        model: mediaEmbeddingModel,
        outputDimensionality: values.length,
        taskType: mediaEmbeddingTaskType,
        modality: "image",
        normalized: true,
        values: normalizeEmbedding(values)
      };
    } catch (error) {
      if (!isRetryableGeminiError(error) || attempt > mediaEmbeddingMaxRetries) {
        console.warn(`Gemini embedding failed for ${filePath}. ${getErrorMessage(error)}`);
        return null;
      }

      const retryDelayMs = computeRetryDelayMs(attempt);
      console.warn(
        `Gemini embedding transient failure for ${filePath} on attempt ${attempt}/${mediaEmbeddingMaxRetries + 1}. Retrying in ${retryDelayMs}ms. ${getErrorMessage(error)}`
      );
      await delay(retryDelayMs);
    }
  }

  return null;
}
