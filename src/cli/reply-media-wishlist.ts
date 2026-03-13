import { parseArgs } from "node:util";
import process from "node:process";
import { readReplyMediaWishlist, setReplyMediaWishlistStatus } from "@/src/server/reply-media-wishlist";

type OutputFormat = "json" | "jsonl";
type Command = "list" | "status";
type WishlistStatus = "pending" | "collected" | "dismissed";

interface WishlistCliOptions {
  command: Command;
  statusFilter: WishlistStatus | "all";
  key: string | null;
  nextStatus: WishlistStatus | null;
  format: OutputFormat;
}

const HELP_TEXT = `Manage the reply asset wishlist.

Usage:
  x-media-analyst wishlist list [--status pending|collected|dismissed|all] [--format json|jsonl]
  x-media-analyst wishlist status --key <key> --status pending|collected|dismissed

Examples:
  x-media-analyst wishlist list
  x-media-analyst wishlist list --status pending --format jsonl
  x-media-analyst wishlist status --key scooby-doo-mask-reveal --status collected`;

function parseWishlistCliArgs(argv: string[]): WishlistCliOptions {
  const commandRaw = argv[0];
  if (commandRaw !== "list" && commandRaw !== "status") {
    throw new Error(`Unknown wishlist command "${commandRaw ?? ""}".`);
  }

  const { values } = parseArgs({
    args: argv.slice(1),
    allowPositionals: true,
    options: {
      status: { type: "string" },
      key: { type: "string" },
      format: { type: "string" },
      jsonl: { type: "boolean" },
      json: { type: "boolean" }
    }
  });

  const statusValue = values.status ?? "all";
  if (!["all", "pending", "collected", "dismissed"].includes(statusValue)) {
    throw new Error(`Unknown status "${statusValue}".`);
  }

  const formatValue = values.jsonl ? "jsonl" : values.format ?? (values.json ? "json" : "json");
  if (formatValue !== "json" && formatValue !== "jsonl") {
    throw new Error(`Unknown format "${formatValue}".`);
  }

  return {
    command: commandRaw,
    statusFilter: statusValue as WishlistStatus | "all",
    key: values.key ?? null,
    nextStatus:
      commandRaw === "status" ? ((statusValue === "all" ? null : statusValue) as WishlistStatus | null) : null,
    format: formatValue
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function main(argv: string[]): void {
  let options: WishlistCliOptions;

  try {
    options = parseWishlistCliArgs(argv);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.stderr.write(`${HELP_TEXT}\n`);
    process.exit(2);
    return;
  }

  if (options.command === "list") {
    const entries = readReplyMediaWishlist().filter((entry) =>
      options.statusFilter === "all" ? true : entry.status === options.statusFilter
    );

    if (options.format === "jsonl") {
      for (const entry of entries) {
        process.stdout.write(`${JSON.stringify(entry)}\n`);
      }
      return;
    }

    printJson({
      command: "wishlist-list",
      status: options.statusFilter,
      count: entries.length,
      entries
    });
    return;
  }

  if (!options.key || !options.nextStatus) {
    process.stderr.write("wishlist status requires --key and --status.\n");
    process.stderr.write(`${HELP_TEXT}\n`);
    process.exit(2);
    return;
  }

  const updated = setReplyMediaWishlistStatus(options.key, options.nextStatus);
  if (!updated) {
    process.stderr.write(`Unknown wishlist key "${options.key}".\n`);
    process.exit(3);
    return;
  }

  printJson({
    command: "wishlist-status",
    key: updated.key,
    status: updated.status
  });
}

main(process.argv.slice(2));
