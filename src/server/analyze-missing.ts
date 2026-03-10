import { setTimeout as delay } from "node:timers/promises";
import { getDashboardData } from "@/src/server/data";
import { analyzeAndIndexTweetUsage } from "@/src/server/analysis-pipeline";

const analysisInterItemDelayMs = Number(process.env.ANALYZE_MISSING_DELAY_MS || 2500);

export interface AnalyzeMissingResult {
  completed: number;
  skipped: number;
  failed: number;
  totalMissing: number;
}

export async function analyzeMissingUsages(): Promise<AnalyzeMissingResult> {
  const data = getDashboardData();
  const missing = data.tweetUsages.filter(
    (usage) => usage.analysis.status !== "complete" && usage.tweet.tweetId
  );

  console.log(`Found ${missing.length} usages missing analysis.`);

  let completed = 0;
  let skipped = 0;
  let failed = 0;

  for (const usage of missing) {
    if (!usage.tweet.tweetId) {
      skipped += 1;
      continue;
    }

    console.log(`Analyzing ${usage.usageId}...`);
    try {
      await analyzeAndIndexTweetUsage(usage.tweet.tweetId, usage.mediaIndex);
      completed += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Analysis failed for ${usage.usageId}: ${message}`);
    }

    if (analysisInterItemDelayMs > 0) {
      await delay(analysisInterItemDelayMs);
    }
  }

  return {
    completed,
    skipped,
    failed,
    totalMissing: missing.length
  };
}
