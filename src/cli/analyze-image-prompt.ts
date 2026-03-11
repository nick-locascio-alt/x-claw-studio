import fs from "node:fs";
import path from "node:path";
import { buildTweetMediaAnalysisPrompt, type GeminiAnalysisPromptVariant } from "@/src/server/gemini-analysis-prompt";
import { analyzeTweetMediaUsageWithOptions } from "@/src/server/gemini-analysis";
import { findTweetUsage } from "@/src/server/tweet-repository";
import type { ExtractedTweet } from "@/src/lib/types";

interface CliOptions {
  tweetId: string | null;
  mediaIndex: number;
  imagePath: string | null;
  tweetText: string | null;
  variant: GeminiAnalysisPromptVariant;
  promptOnly: boolean;
  printPrompt: boolean;
  outPath: string | null;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    tweetId: null,
    mediaIndex: 0,
    imagePath: null,
    tweetText: null,
    variant: "cultural_audit",
    promptOnly: false,
    printPrompt: false,
    outPath: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--tweet-id":
        options.tweetId = next ?? null;
        index += 1;
        break;
      case "--media-index":
        options.mediaIndex = Number(next ?? "0");
        index += 1;
        break;
      case "--image":
        options.imagePath = next ? path.resolve(next) : null;
        index += 1;
        break;
      case "--text":
        options.tweetText = next ?? null;
        index += 1;
        break;
      case "--variant":
        if (next === "baseline" || next === "cultural_audit") {
          options.variant = next;
        } else {
          throw new Error(`Unsupported --variant value: ${next}`);
        }
        index += 1;
        break;
      case "--prompt-only":
        options.promptOnly = true;
        break;
      case "--print-prompt":
        options.printPrompt = true;
        break;
      case "--out":
        options.outPath = next ? path.resolve(next) : null;
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function buildSyntheticTweet(options: CliOptions): ExtractedTweet {
  if (!options.imagePath) {
    throw new Error("--image is required when --tweet-id is not provided");
  }

  return {
    sourceName: "prompt-lab",
    tweetId: null,
    tweetUrl: null,
    authorHandle: null,
    authorUsername: null,
    authorDisplayName: null,
    authorProfileImageUrl: null,
    createdAt: null,
    text: options.tweetText,
    metrics: {
      replies: null,
      reposts: null,
      likes: null,
      bookmarks: null,
      views: null
    },
    media: [
      {
        mediaKind: "image",
        sourceUrl: options.imagePath,
        previewUrl: options.imagePath,
        posterUrl: options.imagePath
      }
    ],
    extraction: {
      articleIndex: 0,
      extractedAt: new Date().toISOString()
    }
  };
}

function resolveTweet(options: CliOptions): ExtractedTweet {
  if (!options.tweetId) {
    return buildSyntheticTweet(options);
  }

  const usage = findTweetUsage(options.tweetId, options.mediaIndex);
  if (!usage) {
    throw new Error(`Tweet usage not found for tweetId=${options.tweetId} mediaIndex=${options.mediaIndex}`);
  }

  return usage.tweet;
}

function writeOutput(outPath: string | null, payload: string): void {
  if (!outPath) {
    return;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, payload);
}

function printUsage(): void {
  console.error(
    "Usage: tsx src/cli/analyze-image-prompt.ts [--tweet-id <id> --media-index <n>] [--image <path>] [--text <tweet text>] [--variant baseline|cultural_audit] [--print-prompt] [--prompt-only] [--out <path>]"
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const tweet = resolveTweet(options);
  const prompt = buildTweetMediaAnalysisPrompt(tweet, options.mediaIndex, options.variant);

  if (options.printPrompt) {
    console.error(prompt);
  }

  if (options.promptOnly) {
    const payload = JSON.stringify(
      {
        variant: options.variant,
        prompt
      },
      null,
      2
    );

    writeOutput(options.outPath, payload);
    console.log(payload);
    return;
  }

  const analysis = await analyzeTweetMediaUsageWithOptions(tweet, {
    mediaIndex: options.mediaIndex,
    mediaSourceOverride: options.imagePath ?? undefined,
    promptVariant: options.variant
  });

  const payload = JSON.stringify(
    {
      variant: options.variant,
      tweetId: tweet.tweetId,
      mediaIndex: options.mediaIndex,
      imagePath: options.imagePath,
      analysis
    },
    null,
    2
  );

  writeOutput(options.outPath, payload);
  console.log(payload);
}

main().catch((error: Error) => {
  printUsage();
  console.error(error.message);
  process.exit(1);
});
