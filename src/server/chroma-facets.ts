import { ChromaClient, type Metadata } from "chromadb";
import { GoogleGenAI } from "@google/genai";
import { ANALYSIS_FACET_NAMES, type AnalysisFacetName } from "@/src/lib/analysis-schema";
import { getGeminiApiKey, loadEnv } from "@/src/lib/env";
import { readAllUsageAnalyses } from "@/src/server/analysis-store";
import { getDashboardData } from "@/src/server/data";
import type { ExtractedTweet, UsageAnalysis } from "@/src/lib/types";

loadEnv();
const chromaUrl = process.env.CHROMA_URL || "http://localhost:8000";
const chromaCollectionName = process.env.CHROMA_COLLECTION || "twitter_trend_facets";
const embeddingModel = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const hybridVectorWeight = Number(process.env.HYBRID_SEARCH_VECTOR_WEIGHT || 0.65);
const hybridLexicalWeight = Number(process.env.HYBRID_SEARCH_LEXICAL_WEIGHT || 0.35);

function facetValueToText(value: UsageAnalysis[AnalysisFacetName]): string | null {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : null;
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return value;
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  const response = await ai.models.embedContent({
    model: embeddingModel,
    contents: texts
  });

  return (response.embeddings ?? [])
    .map((item) => item.values ?? [])
    .filter((embedding): embedding is number[] => embedding.length > 0);
}

async function getCollection() {
  const client = new ChromaClient({ path: chromaUrl });
  return client.getOrCreateCollection({
    name: chromaCollectionName,
    metadata: { domain: "twitter_trend_facets" }
  });
}

export interface HybridSearchRow {
  id: string;
  document: string;
  metadata: Metadata;
  media: {
    mediaAssetId: string | null;
    mediaLocalFilePath: string | null;
    sourceUrl: string | null;
    previewUrl: string | null;
    posterUrl: string | null;
    tweetText: string | null;
    authorUsername: string | null;
  } | null;
  vectorDistance: number | null;
  vectorScore: number;
  lexicalScore: number;
  combinedScore: number;
  matchedBy: Array<"vector" | "lexical">;
}

export interface HybridSearchResult {
  query: string;
  facetName: AnalysisFacetName | null;
  limit: number;
  results: HybridSearchRow[];
}

function normalizeScore(value: number, maxValue: number): number {
  if (!Number.isFinite(value) || maxValue <= 0) {
    return 0;
  }

  return value / maxValue;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function buildFacetDocument(analysis: UsageAnalysis, facetName: AnalysisFacetName): string | null {
  const facetText = facetValueToText(analysis[facetName]);
  if (!facetText) {
    return null;
  }

  return [`facet_name: ${facetName}`, `facet_value: ${facetText}`, `media_kind: ${analysis.mediaKind}`].join("\n");
}

function buildFacetMetadata(analysis: UsageAnalysis, facetName: AnalysisFacetName): Record<string, string | number | boolean | null> {
  return {
    usage_id: analysis.usageId,
    tweet_id: analysis.tweetId ?? "unknown",
    facet_name: facetName,
    media_kind: analysis.mediaKind
  };
}

function buildLexicalRows(params: {
  query: string;
  facetName?: AnalysisFacetName;
  limit: number;
}): HybridSearchRow[] {
  const usageMap = new Map(getDashboardData().tweetUsages.map((usage) => [usage.usageId, usage]));
  const analyses = readAllUsageAnalyses().filter((analysis) => analysis.status === "complete");
  const docs: Array<{
    id: string;
    document: string;
    metadata: Record<string, string | number | boolean | null>;
    tokens: string[];
  }> = [];

  for (const analysis of analyses) {
    for (const facet of ANALYSIS_FACET_NAMES) {
      if (params.facetName && facet !== params.facetName) {
        continue;
      }

      const document = buildFacetDocument(analysis, facet);
      if (!document) {
        continue;
      }

      docs.push({
        id: `${analysis.usageId}::${facet}`,
        document,
        metadata: buildFacetMetadata(analysis, facet),
        tokens: tokenize(document)
      });
    }
  }

  const queryTokens = tokenize(params.query);
  if (queryTokens.length === 0) {
    return [];
  }

  const docFrequency = new Map<string, number>();
  for (const doc of docs) {
    for (const token of new Set(doc.tokens)) {
      docFrequency.set(token, (docFrequency.get(token) ?? 0) + 1);
    }
  }

  const avgDocLength = docs.length > 0 ? docs.reduce((sum, doc) => sum + doc.tokens.length, 0) / docs.length : 0;
  const k1 = 1.2;
  const b = 0.75;

  const scored = docs
    .map((doc) => {
      const termCounts = new Map<string, number>();
      for (const token of doc.tokens) {
        termCounts.set(token, (termCounts.get(token) ?? 0) + 1);
      }

      const score = queryTokens.reduce((sum, token) => {
        const tf = termCounts.get(token) ?? 0;
        if (tf === 0) {
          return sum;
        }

        const df = docFrequency.get(token) ?? 0;
        const idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + (b * doc.tokens.length) / Math.max(avgDocLength, 1));
        return sum + idf * (numerator / denominator);
      }, 0);

      return { doc, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  const maxScore = scored[0]?.score ?? 0;

  return scored.slice(0, params.limit * 3).map(({ doc, score }) => ({
    id: doc.id,
    document: doc.document,
    metadata: doc.metadata,
    media: (() => {
      const usageId = String(doc.metadata.usage_id ?? "");
      const usage = usageMap.get(usageId);
      if (!usage) {
        return null;
      }

      const media = usage.tweet.media[usage.mediaIndex];
      return {
        mediaAssetId: usage.mediaAssetId,
        mediaLocalFilePath: usage.mediaLocalFilePath,
        sourceUrl: media?.sourceUrl ?? null,
        previewUrl: media?.previewUrl ?? null,
        posterUrl: media?.posterUrl ?? null,
        tweetText: usage.tweet.text,
        authorUsername: usage.tweet.authorUsername
      };
    })(),
    vectorDistance: null,
    vectorScore: 0,
    lexicalScore: normalizeScore(score, maxScore),
    combinedScore: 0,
    matchedBy: ["lexical"]
  }));
}

export async function indexUsageAnalysisInChroma(
  tweet: ExtractedTweet,
  analysis: UsageAnalysis
): Promise<{ indexedCount: number }> {
  const docs: string[] = [];
  const ids: string[] = [];
  const metadatas: Metadata[] = [];

  for (const facetName of ANALYSIS_FACET_NAMES) {
    const rawValue = analysis[facetName];
    const facetText = facetValueToText(rawValue);
    if (!facetText) {
      continue;
    }

    ids.push(`${analysis.usageId}::${facetName}`);
    docs.push(
      [
        `facet_name: ${facetName}`,
        `facet_value: ${facetText}`,
        `tweet_text: ${tweet.text ?? ""}`,
        `author_username: ${tweet.authorUsername ?? ""}`,
        `media_kind: ${analysis.mediaKind}`
      ].join("\n")
    );
    metadatas.push({
      usage_id: analysis.usageId,
      tweet_id: analysis.tweetId ?? "unknown",
      author_username: tweet.authorUsername ?? "unknown",
      facet_name: facetName,
      media_kind: analysis.mediaKind
    });
  }

  if (docs.length === 0) {
    return { indexedCount: 0 };
  }

  const embeddings = await embedTexts(docs);
  const collection = await getCollection();
  await collection.upsert({
    ids,
    documents: docs,
    metadatas,
    embeddings
  });

  return { indexedCount: docs.length };
}

export async function searchFacetIndex(params: {
  query: string;
  facetName?: AnalysisFacetName;
  limit?: number;
}): Promise<HybridSearchResult> {
  const limit = params.limit ?? 8;
  const usageMap = new Map(getDashboardData().tweetUsages.map((usage) => [usage.usageId, usage]));
  const lexicalRows = buildLexicalRows({
    query: params.query,
    facetName: params.facetName,
    limit
  });

  let vectorRows: HybridSearchRow[] = [];
  try {
    const collection = await getCollection();
    const queryEmbeddings = await embedTexts([params.query]);
    const result = await collection.query({
      queryEmbeddings,
      nResults: limit * 3,
      where: params.facetName ? { facet_name: params.facetName } : undefined,
      include: ["documents", "metadatas", "distances"]
    });

    const distances = (result.distances?.[0] ?? []).filter(
      (distance): distance is number => typeof distance === "number"
    );
    const maxDistance = distances.length > 0 ? Math.max(...distances) : 0;

    vectorRows =
      result.ids?.[0]?.map((id, index) => {
        const distance = distances[index] ?? null;
        const vectorScore =
          distance === null
            ? 0
            : maxDistance > 0
              ? 1 - distance / maxDistance
              : 1;

        return {
          id,
          document: result.documents?.[0]?.[index] ?? "",
          metadata: result.metadatas?.[0]?.[index] ?? {},
          media: (() => {
            const usageId = String(result.metadatas?.[0]?.[index]?.usage_id ?? "");
            const usage = usageMap.get(usageId);
            if (!usage) {
              return null;
            }

            const media = usage.tweet.media[usage.mediaIndex];
            return {
              mediaAssetId: usage.mediaAssetId,
              mediaLocalFilePath: usage.mediaLocalFilePath,
              sourceUrl: media?.sourceUrl ?? null,
              previewUrl: media?.previewUrl ?? null,
              posterUrl: media?.posterUrl ?? null,
              tweetText: usage.tweet.text,
              authorUsername: usage.tweet.authorUsername
            };
          })(),
          vectorDistance: distance,
          vectorScore,
          lexicalScore: 0,
          combinedScore: 0,
          matchedBy: ["vector"]
        };
      }) ?? [];
  } catch (error) {
    console.warn(`Vector search failed, falling back to lexical only: ${error instanceof Error ? error.message : String(error)}`);
  }

  const merged = new Map<string, HybridSearchRow>();

  for (const row of vectorRows) {
    merged.set(row.id, row);
  }

  for (const row of lexicalRows) {
    const existing = merged.get(row.id);
    if (!existing) {
      merged.set(row.id, row);
      continue;
    }

    merged.set(row.id, {
      ...existing,
      lexicalScore: row.lexicalScore,
      combinedScore: 0,
      matchedBy: Array.from(new Set([...existing.matchedBy, "lexical"]))
    });
  }

  const rows = Array.from(merged.values())
    .map((row) => ({
      ...row,
      combinedScore: row.vectorScore * hybridVectorWeight + row.lexicalScore * hybridLexicalWeight
    }))
    .sort((left, right) => {
      if (right.combinedScore !== left.combinedScore) {
        return right.combinedScore - left.combinedScore;
      }

      if (left.vectorDistance !== null && right.vectorDistance !== null && left.vectorDistance !== right.vectorDistance) {
        return left.vectorDistance - right.vectorDistance;
      }

      return right.lexicalScore - left.lexicalScore;
    })
    .slice(0, limit);

  return {
    query: params.query,
    facetName: params.facetName ?? null,
    limit,
    results: rows
  };
}
