import { parseArgs } from "node:util";
import { analyzeTopics } from "@/src/server/analyze-topics";

const HELP_TEXT = `Analyze tweet topics with Gemini and rebuild the cached topic index.

Usage:
  npm run analyze:topics -- [--limit <n>] [--force]

Options:
  --limit <n>   Analyze at most n uncached tweets in this run. Default: 100.
  --force       Re-analyze tweets even if a cached topic analysis already exists.
  --help        Show this help text.
`;

function parseCliArgs(argv: string[]): { limit?: number; force: boolean; help: boolean } {
  const { values } = parseArgs({
    args: argv,
    options: {
      limit: { type: "string" },
      force: { type: "boolean" },
      help: { type: "boolean", short: "h" }
    },
    strict: true
  });

  const limit = values.limit ? Number(values.limit) : undefined;
  if (values.limit && (!Number.isFinite(limit) || limit! <= 0)) {
    throw new Error(`Invalid --limit value "${values.limit}". Expected a positive number.`);
  }

  return {
    limit,
    force: Boolean(values.force),
    help: Boolean(values.help)
  };
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${HELP_TEXT}\n`);
    return;
  }

  const result = await analyzeTopics({
    limit: options.limit,
    force: options.force
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
