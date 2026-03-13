import "@/src/lib/env";
import { parseArgs } from "node:util";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { searchTopicIndex, type TopicSearchResult } from "@/src/server/chroma-facets";

type OutputFormat = "json" | "jsonl";

interface SearchTopicCliOptions {
  query: string | null;
  limit: number;
  format: OutputFormat;
  help: boolean;
}

const HELP_TEXT = `Search topic analyses with opinion and relevance signals.

Usage:
  x-media-analyst search topics --query "<query>" [--limit <n>] [--format json|jsonl]
  x-media-analyst search topics "<query>"

Flags:
  -q, --query <query>     Search query text. Required.
  -l, --limit <n>         Max results to return. Default: 12.
  --format <format>       Output format: json or jsonl. Default: json.
  --json                  Alias for --format json.
  --jsonl                 Alias for --format jsonl.
  -h, --help              Show this help text.

Exit codes:
  0  Success
  2  Usage error or invalid arguments

Examples:
  x-media-analyst search topics --query "AI coding tools collapse into one stack"
  x-media-analyst search topics "OpenAI pricing backlash" --limit 5 --jsonl`;

function parseLimit(value: string | undefined): number {
  if (!value) {
    return 12;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid --limit value "${value}". Expected a positive integer.`);
  }

  return parsed;
}

export function parseSearchTopicCliArgs(argv: string[]): SearchTopicCliOptions {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      query: { type: "string", short: "q" },
      limit: { type: "string", short: "l" },
      format: { type: "string" },
      json: { type: "boolean" },
      jsonl: { type: "boolean" },
      help: { type: "boolean", short: "h" }
    }
  });

  if (values.json && values.jsonl) {
    throw new Error("Choose only one of --json or --jsonl.");
  }

  const query = values.query ?? positionals[0] ?? null;
  const formatRaw = values.format ?? (values.jsonl ? "jsonl" : "json");
  const format = formatRaw === "jsonl" ? "jsonl" : formatRaw === "json" ? "json" : null;

  if (!format) {
    throw new Error(`Invalid --format value "${formatRaw}". Expected "json" or "jsonl".`);
  }

  return {
    query,
    limit: parseLimit(values.limit),
    format,
    help: Boolean(values.help)
  };
}

export function buildAgentTopicSearchPayload(result: TopicSearchResult) {
  return {
    command: "search-topics",
    query: result.query,
    limit: result.limit,
    result_count: result.results.length,
    results: result.results.map((row, index) => ({
      rank: index + 1,
      result_id: row.id,
      scores: {
        combined_score: row.combinedScore,
        vector_score: row.vectorScore,
        lexical_score: row.lexicalScore,
        vector_distance: row.vectorDistance,
        matched_by: row.matchedBy
      },
      topic: {
        topic_id: row.topic.topicId,
        label: row.topic.label,
        hotness_score: row.topic.hotnessScore,
        tweet_count: row.topic.tweetCount,
        is_stale: row.topic.isStale
      },
      tweet: {
        tweet_key: row.tweet.tweetKey,
        tweet_id: row.tweet.tweetId,
        author_username: row.tweet.authorUsername,
        created_at: row.tweet.createdAt,
        text: row.tweet.text
      },
      analysis: {
        analysis_id: row.analysis.analysisId,
        summary_label: row.analysis.summaryLabel,
        is_news: row.analysis.isNews,
        news_peg: row.analysis.newsPeg,
        why_now: row.analysis.whyNow,
        sentiment: row.analysis.sentiment,
        stance: row.analysis.stance,
        emotional_tone: row.analysis.emotionalTone,
        opinion_intensity: row.analysis.opinionIntensity,
        target_entity: row.analysis.targetEntity,
        signals: row.analysis.signals
      },
      usage_ids: row.usageIds,
      search_document: row.document,
      raw_metadata: row.metadata
    }))
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printJsonLines(value: ReturnType<typeof buildAgentTopicSearchPayload>): void {
  process.stdout.write(
    `${JSON.stringify({
      type: "search_meta",
      command: value.command,
      query: value.query,
      limit: value.limit,
      result_count: value.result_count
    })}\n`
  );

  for (const row of value.results) {
    process.stdout.write(`${JSON.stringify({ type: "search_result", ...row })}\n`);
  }
}

async function main(argv: string[]): Promise<void> {
  let options: SearchTopicCliOptions;

  try {
    options = parseSearchTopicCliArgs(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.stderr.write('Run "x-media-analyst search topics --help" for usage.\n');
    process.exit(2);
  }

  if (options.help) {
    process.stdout.write(`${HELP_TEXT}\n`);
    return;
  }

  if (!options.query) {
    process.stderr.write("Missing query. Provide --query <text> or a positional query argument.\n");
    process.stderr.write('Run "x-media-analyst search topics --help" for usage.\n');
    process.exit(2);
  }

  const result = await searchTopicIndex({
    query: options.query,
    limit: options.limit
  });
  const payload = buildAgentTopicSearchPayload(result);

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
