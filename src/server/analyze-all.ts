import { setTimeout as delay } from "node:timers/promises";
import { getDashboardData } from "@/src/server/data";
import { analyzeAndIndexTweetUsage } from "@/src/server/analysis-pipeline";

const analysisInterItemDelayMs = Number(process.env.ANALYZE_ALL_DELAY_MS || process.env.ANALYZE_MISSING_DELAY_MS || 2500);

export interface AnalyzeAllResult {
  completed: number;
  skipped: number;
  failed: number;
  totalQueued: number;
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 1000) {
    return `${Math.max(0, Math.round(ms))}ms`;
  }

  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export async function analyzeAllUsages(): Promise<AnalyzeAllResult> {
  const startedAt = Date.now();
  const data = getDashboardData();
  const queued = data.tweetUsages.filter((usage) => usage.tweet.tweetId);

  console.log(
    `Found ${queued.length} usages eligible for full re-analysis. interItemDelay=${analysisInterItemDelayMs}ms`
  );

  let completed = 0;
  let skipped = 0;
  let failed = 0;

  for (const [index, usage] of queued.entries()) {
    if (!usage.tweet.tweetId) {
      skipped += 1;
      continue;
    }

    const itemStartedAt = Date.now();
    console.log(
      `Re-analyzing ${usage.usageId}... item=${index + 1}/${queued.length} completed=${completed} failed=${failed} skipped=${skipped} elapsed=${formatDuration(itemStartedAt - startedAt)}`
    );

    try {
      await analyzeAndIndexTweetUsage(usage.tweet.tweetId, usage.mediaIndex);
      completed += 1;
      const elapsedMs = Date.now() - itemStartedAt;
      const processed = completed + failed + skipped;
      const averageMs = processed > 0 ? (Date.now() - startedAt) / processed : 0;
      const remaining = Math.max(0, queued.length - processed);
      const etaMs = averageMs * remaining;
      console.log(
        `Re-analysis complete for ${usage.usageId}. item=${index + 1}/${queued.length} duration=${formatDuration(elapsedMs)} completed=${completed} failed=${failed} skipped=${skipped} eta=${formatDuration(etaMs)}`
      );
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      const elapsedMs = Date.now() - itemStartedAt;
      console.error(
        `Re-analysis failed for ${usage.usageId}. item=${index + 1}/${queued.length} duration=${formatDuration(elapsedMs)} completed=${completed} failed=${failed} skipped=${skipped} error=${message}`
      );
    }

    if (analysisInterItemDelayMs > 0 && index < queued.length - 1) {
      console.log(
        `Waiting ${analysisInterItemDelayMs}ms before next re-analysis item... nextItem=${index + 2}/${queued.length}`
      );
      await delay(analysisInterItemDelayMs);
    }
  }

  console.log(
    `Full re-analysis sweep finished in ${formatDuration(Date.now() - startedAt)}. completed=${completed} failed=${failed} skipped=${skipped} totalQueued=${queued.length}`
  );

  return {
    completed,
    skipped,
    failed,
    totalQueued: queued.length
  };
}
