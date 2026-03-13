import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveMediaDisplayUrl } from "@/src/lib/media-display";
import type { ReplyMediaCandidate } from "@/src/lib/reply-composer";
import { runCliCommand } from "@/src/server/cli-process";
import { searchMemeTemplates } from "@/src/server/meme-template-search";

interface FacetSearchPayload {
  command: string;
  query: string;
  limit: number;
  result_count: number;
  results: Array<{
    result_id: string;
    matched_facet: {
      name: string | null;
      description: string | null;
      value: unknown;
    };
    scores: {
      combined_score: number;
    };
    usage: {
      usage_id: string | null;
      tweet_id: string | null;
    };
    tweet: {
      tweet_url: string | null;
      author_username: string | null;
      created_at: string | null;
      text: string | null;
    };
    media: {
      source_url: string | null;
      preview_url: string | null;
      poster_url: string | null;
      local_file_path: string | null;
      playable_file_path: string | null;
    };
    analysis: {
      mediaKind?: string | null;
      caption_brief?: string | null;
      scene_description?: string | null;
      primary_emotion?: string | null;
      conveys?: string | null;
      rhetorical_role?: string | null;
      cultural_reference?: string | null;
      analogy_target?: string | null;
      search_keywords?: string[];
    } | null;
    raw_metadata?: {
      media_asset_id?: string | null;
    };
  }>;
}

export interface ReplyMediaSearchProvider {
  providerId: string;
  searchMany(queries: string[], limitPerQuery?: number): Promise<{
    candidates: ReplyMediaCandidate[];
    warning: string | null;
    queryOutcomes: Array<{
      query: string;
      resultCount: number;
    }>;
  }>;
}

const cliFilePath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(cliFilePath), "..", "..");
const binPath = path.join(repoRoot, "bin", "x-media-analyst.mjs");
const searchTimeoutMs = Number(process.env.REPLY_MEDIA_SEARCH_TIMEOUT_MS || 30_000);

function extractJsonPayload(stdout: string): string {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error("Search CLI returned empty output");
  }

  if (trimmed.startsWith("{")) {
    return trimmed;
  }

  const objectIndex = trimmed.indexOf("{");
  if (objectIndex === -1) {
    throw new Error(`Search CLI did not return JSON. Output was: ${trimmed.slice(0, 200)}`);
  }

  return trimmed.slice(objectIndex);
}

function parseSearchPayload(stdout: string): FacetSearchPayload {
  return JSON.parse(extractJsonPayload(stdout)) as FacetSearchPayload;
}

function buildCandidate(
  row: FacetSearchPayload["results"][number],
  query: string
): ReplyMediaCandidate | null {
  const usageId = row.usage.usage_id;
  if (!usageId) {
    return null;
  }

  const displayUrl = resolveMediaDisplayUrl({
    localFilePath: row.media.local_file_path,
    posterUrl: row.media.poster_url,
    previewUrl: row.media.preview_url,
    sourceUrl: row.media.source_url
  });

  return {
    candidateId: `${usageId}::${row.raw_metadata?.media_asset_id ?? row.result_id}`,
    usageId,
    assetId: row.raw_metadata?.media_asset_id ?? null,
    tweetId: row.usage.tweet_id,
    tweetUrl: row.tweet.tweet_url,
    authorUsername: row.tweet.author_username,
    createdAt: row.tweet.created_at,
    tweetText: row.tweet.text,
    displayUrl,
    localFilePath: row.media.local_file_path,
    videoFilePath: row.media.playable_file_path,
    mediaKind: row.analysis?.mediaKind ?? null,
    combinedScore: row.scores.combined_score,
    matchReason: row.matched_facet.name
      ? `matched ${row.matched_facet.name} for query "${query}"`
      : `query "${query}"`,
    sourceType: "usage_facet",
    sourceLabel: row.tweet.text,
    analysis: row.analysis
      ? {
          captionBrief: row.analysis.caption_brief ?? null,
          sceneDescription: row.analysis.scene_description ?? null,
          primaryEmotion: row.analysis.primary_emotion ?? null,
          conveys: row.analysis.conveys ?? null,
          rhetoricalRole: row.analysis.rhetorical_role ?? null,
          culturalReference: row.analysis.cultural_reference ?? null,
          analogyTarget: row.analysis.analogy_target ?? null,
          searchKeywords: row.analysis.search_keywords ?? []
        }
      : null
  };
}

function dedupeCandidates(candidates: ReplyMediaCandidate[]): ReplyMediaCandidate[] {
  const byKey = new Map<string, ReplyMediaCandidate>();

  for (const candidate of candidates) {
    const key = `${candidate.sourceType}:${candidate.assetId ?? candidate.usageId ?? candidate.candidateId}`;
    const current = byKey.get(key);
    if (!current || candidate.combinedScore > current.combinedScore) {
      byKey.set(key, candidate);
    }
  }

  return Array.from(byKey.values())
    .sort((left, right) => right.combinedScore - left.combinedScore)
    .slice(0, 8);
}

export class CliFacetReplyMediaSearchProvider implements ReplyMediaSearchProvider {
  providerId = "x-media-analyst-search-facets";

  async searchMany(queries: string[], limitPerQuery = 6): Promise<{
    candidates: ReplyMediaCandidate[];
    warning: string | null;
    queryOutcomes: Array<{
      query: string;
      resultCount: number;
    }>;
  }> {
    const memeTemplateResult = searchMemeTemplates(queries, Math.max(2, Math.min(4, limitPerQuery)));
    let settled: Array<{ query: string; payload: FacetSearchPayload }> = [];
    let warning: string | null = null;

    try {
      settled = await Promise.all(
        queries.map(async (query) => {
          const result = await runCliCommand({
            command: process.execPath,
            args: [binPath, "search", "facets", "--query", query, "--limit", String(limitPerQuery), "--format", "json"],
            cwd: repoRoot,
            env: {
              ...process.env,
              X_TREND_PROJECT_ROOT: repoRoot
            },
            timeoutMs: searchTimeoutMs
          });

          if (result.exitCode !== 0) {
            throw new Error(result.stderr.trim() || `Search CLI exited with code ${result.exitCode}`);
          }

          return { query, payload: parseSearchPayload(result.stdout) };
        })
      );
    } catch (error) {
      warning = error instanceof Error ? error.message : String(error);
    }

    const candidates = dedupeCandidates([
      ...settled.flatMap(({ query, payload }) =>
        payload.results.map((row) => buildCandidate(row, query)).filter((value): value is ReplyMediaCandidate => Boolean(value))
      ),
      ...memeTemplateResult.candidates
    ]);

    return {
      candidates,
      warning,
      queryOutcomes: queries.map((query) => {
        const payload = settled.find((item) => item.query === query)?.payload ?? null;
        const memeTemplateCount = memeTemplateResult.queryOutcomes.find((item) => item.query === query)?.resultCount ?? 0;
        return {
          query,
          resultCount: (payload?.result_count ?? 0) + memeTemplateCount
        };
      })
    };
  }
}
