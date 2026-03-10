import "@/src/lib/env";
import { analyzeAndIndexTweetUsage } from "@/src/server/analysis-pipeline";

const tweetId = process.argv[2];
const mediaIndex = Number(process.argv[3] || 0);

if (!tweetId) {
  console.error("Usage: tsx src/cli/analyze-tweet.ts <tweetId> [mediaIndex]");
  process.exit(1);
}

async function main(): Promise<void> {
  const result = await analyzeAndIndexTweetUsage(tweetId, mediaIndex);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: Error) => {
  console.error(error);
  process.exit(1);
});
