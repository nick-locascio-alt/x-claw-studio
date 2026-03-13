import "@/src/lib/env";
import { parseArgs } from "node:util";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  ANALYSIS_FACET_CATALOG,
  ANALYSIS_FACET_DESCRIPTIONS,
  ANALYSIS_FACET_NAMES,
  type AnalysisFacetName
} from "@/src/lib/analysis-schema";
import type { TweetUsageRecord } from "@/src/lib/types";
import { searchFacetIndex, type HybridSearchResult, type HybridSearchRow } from "@/src/server/chroma-facets";
import { getDashboardData } from "@/src/server/data";

type OutputFormat = "json" | "jsonl";

interface SearchFacetCliOptions {
  query: string | null;
  facetName: AnalysisFacetName | null;
  limit: number;
  format: OutputFormat;
  listFacets: boolean;
  help: boolean;
}

const HELP_TEXT = `Search usage-analysis facets with agent-friendly structured output.

Usage:
  x-media-analyst search facets --query "<query>" [--facet <name>] [--limit <n>] [--format json|jsonl]
  x-media-analyst search facets "<query>" [facetName]
  x-media-analyst facet list

Flags:
  -q, --query <query>     Search query text. Required unless --list-facets is used.
  --facet <name>          Restrict search to one facet.
  -l, --limit <n>         Max results to return. Default: 20.
  --format <format>       Output format: json or jsonl. Default: json.
  --json                  Alias for --format json.
  --jsonl                 Alias for --format jsonl.
  --list-facets           Print the facet catalog with names, value types, and descriptions.
  -h, --help              Show this help text.

Exit codes:
  0  Success
  2  Usage error or invalid arguments
  3  Requested facet was not found

Examples:
  x-media-analyst search facets --query "terminal dashboard" --facet scene_description --limit 5
  x-media-analyst search facets "reaction image" conveys
  x-media-analyst facet list --format json`;

function isFacetName(value: string | null | undefined): value is AnalysisFacetName {
  return typeof value === "string" && ANALYSIS_FACET_NAMES.includes(value as AnalysisFacetName);
}

function parseLimit(value: string | undefined): number {
  if (!value) {
    return 20;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid --limit value "${value}". Expected a positive integer.`);
  }

  return parsed;
}

export function parseSearchFacetCliArgs(argv: string[]): SearchFacetCliOptions {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      query: { type: "string", short: "q" },
      facet: { type: "string" },
      limit: { type: "string", short: "l" },
      format: { type: "string" },
      json: { type: "boolean" },
      jsonl: { type: "boolean" },
      "list-facets": { type: "boolean" },
      help: { type: "boolean", short: "h" }
    }
  });

  if (values.json && values.jsonl) {
    throw new Error("Choose only one of --json or --jsonl.");
  }

  const query = values.query ?? positionals[0] ?? null;
  const facetRaw = values.facet ?? positionals[1] ?? null;
  const formatRaw = values.format ?? (values.jsonl ? "jsonl" : "json");
  const format = formatRaw === "jsonl" ? "jsonl" : formatRaw === "json" ? "json" : null;

  if (!format) {
    throw new Error(`Invalid --format value "${formatRaw}". Expected "json" or "jsonl".`);
  }

  if (facetRaw && !isFacetName(facetRaw)) {
    const error = new Error(`Unknown facet "${facetRaw}".`);
    error.name = "UnknownFacetError";
    throw error;
  }

  return {
    query,
    facetName: facetRaw as AnalysisFacetName | null,
    limit: parseLimit(values.limit),
    format,
    listFacets: Boolean(values["list-facets"]),
    help: Boolean(values.help)
  };
}

function getRowUsageId(row: HybridSearchRow): string | null {
  const usageId = row.metadata.usage_id;
  return typeof usageId === "string" && usageId.length > 0 ? usageId : null;
}

function buildUsageMap(): Map<string, TweetUsageRecord> {
  return new Map(getDashboardData().tweetUsages.map((usage) => [usage.usageId, usage]));
}

export function buildAgentFacetSearchPayload(result: HybridSearchResult, usageMap: Map<string, TweetUsageRecord>) {
  return {
    command: "search-facets",
    query: result.query,
    limit: result.limit,
    result_count: result.results.length,
    facet: result.facetName
      ? {
          name: result.facetName,
          description: ANALYSIS_FACET_DESCRIPTIONS[result.facetName]
        }
      : null,
    results: result.results.map((row, index) => {
      const usageId = getRowUsageId(row);
      const usage = usageId ? usageMap.get(usageId) ?? null : null;
      const facetNameRaw = typeof row.metadata.facet_name === "string" ? row.metadata.facet_name : null;
      const facetName = isFacetName(facetNameRaw) ? facetNameRaw : null;
      const facetDescription =
        (typeof row.metadata.facet_description === "string" ? row.metadata.facet_description : null) ??
        (facetName ? ANALYSIS_FACET_DESCRIPTIONS[facetName] : null);

      return {
        rank: index + 1,
        result_id: row.id,
        matched_facet: {
          name: facetNameRaw,
          description: facetDescription,
          value: row.metadata.facet_value ?? (facetName && usage ? usage.analysis[facetName] : null)
        },
        scores: {
          combined_score: row.combinedScore,
          vector_score: row.vectorScore,
          lexical_score: row.lexicalScore,
          vector_distance: row.vectorDistance,
          matched_by: row.matchedBy
        },
        usage: {
          usage_id: usage?.usageId ?? usageId,
          tweet_id:
            usage?.tweet.tweetId ??
            (typeof row.metadata.tweet_id === "string" && row.metadata.tweet_id !== "unknown" ? row.metadata.tweet_id : null),
          media_index: usage?.mediaIndex ?? row.media?.mediaIndex ?? (typeof row.metadata.media_index === "number" ? row.metadata.media_index : null),
          media_kind:
            usage?.analysis.mediaKind ?? (typeof row.metadata.media_kind === "string" ? row.metadata.media_kind : null),
          media_asset_id: usage?.mediaAssetId ?? row.media?.mediaAssetId ?? null,
          duplicate_group_id: usage?.duplicateGroupId ?? row.media?.duplicateGroupId ?? null,
          hotness_score: usage?.hotnessScore ?? row.media?.hotnessScore ?? null,
          media_asset_starred: usage?.mediaAssetStarred ?? row.media?.mediaAssetStarred ?? null,
          media_asset_usage_count: usage?.mediaAssetUsageCount ?? row.media?.mediaAssetUsageCount ?? null
        },
        tweet: {
          source_name: usage?.tweet.sourceName ?? null,
          tweet_url: usage?.tweet.tweetUrl ?? row.media?.tweetUrl ?? null,
          author_handle: usage?.tweet.authorHandle ?? row.media?.authorHandle ?? null,
          author_username: usage?.tweet.authorUsername ?? row.media?.authorUsername ?? null,
          author_display_name: usage?.tweet.authorDisplayName ?? row.media?.authorDisplayName ?? null,
          created_at: usage?.tweet.createdAt ?? row.media?.createdAt ?? null,
          text: usage?.tweet.text ?? row.media?.tweetText ?? null
        },
        media: {
          source_url: row.media?.sourceUrl ?? null,
          preview_url: row.media?.previewUrl ?? null,
          poster_url: row.media?.posterUrl ?? null,
          local_file_path: row.media?.mediaLocalFilePath ?? null,
          playable_file_path: row.media?.mediaPlayableFilePath ?? null
        },
        analysis: usage?.analysis ?? null,
        search_document: row.document,
        raw_metadata: row.metadata
      };
    })
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printJsonLines(value: ReturnType<typeof buildAgentFacetSearchPayload>): void {
  process.stdout.write(
    `${JSON.stringify({
      type: "search_meta",
      command: value.command,
      query: value.query,
      limit: value.limit,
      result_count: value.result_count,
      facet: value.facet
    })}\n`
  );

  for (const row of value.results) {
    process.stdout.write(`${JSON.stringify({ type: "search_result", ...row })}\n`);
  }
}

async function main(argv: string[]): Promise<void> {
  let options: SearchFacetCliOptions;

  try {
    options = parseSearchFacetCliArgs(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const exitCode = error instanceof Error && error.name === "UnknownFacetError" ? 3 : 2;
    process.stderr.write(`${message}\n`);
    process.stderr.write('Run "x-media-analyst search facets --help" for usage.\n');
    process.exit(exitCode);
  }

  if (options.help) {
    process.stdout.write(`${HELP_TEXT}\n`);
    return;
  }

  if (options.listFacets) {
    const payload = {
      command: "search-facets",
      facet_count: ANALYSIS_FACET_CATALOG.length,
      facets: ANALYSIS_FACET_CATALOG
    };

    if (options.format === "jsonl") {
      for (const facet of payload.facets) {
        process.stdout.write(`${JSON.stringify({ type: "facet", ...facet })}\n`);
      }
      return;
    }

    printJson(payload);
    return;
  }

  if (!options.query) {
    process.stderr.write("Missing query. Provide --query <text> or a positional query argument.\n");
    process.stderr.write('Run "x-media-analyst search facets --help" for usage.\n');
    process.exit(2);
  }

  const result = await searchFacetIndex({
    query: options.query,
    facetName: options.facetName ?? undefined,
    limit: options.limit
  });

  const payload = buildAgentFacetSearchPayload(result, buildUsageMap());

  if (options.format === "jsonl") {
    printJsonLines(payload);
    return;
  }

  printJson(payload);
}

const entryScriptPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;

if (entryScriptPath && import.meta.url === entryScriptPath) {
  void main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
