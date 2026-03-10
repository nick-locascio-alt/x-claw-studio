import { buildUsageId } from "@/src/lib/usage-id";
import { analyzeTweetMediaUsage } from "@/src/server/gemini-analysis";
import { writeUsageAnalysis } from "@/src/server/analysis-store";
import { indexUsageAnalysisInChroma } from "@/src/server/chroma-facets";
import { buildMediaAssetSummaries, readMediaAssetIndex } from "@/src/server/media-assets";
import { getDashboardData } from "@/src/server/data";
import { findTweetUsage } from "@/src/server/tweet-repository";

export async function analyzeAndIndexTweetUsage(tweetId: string, mediaIndex = 0) {
  const usage = findTweetUsage(tweetId, mediaIndex);
  if (!usage) {
    throw new Error(`Tweet usage not found for tweetId=${tweetId} mediaIndex=${mediaIndex}`);
  }

  const analysis = await analyzeTweetMediaUsage(usage.tweet, usage.mediaIndex);
  const filePath = writeUsageAnalysis(analysis);
  const indexResult = await indexUsageAnalysisInChroma(usage.tweet, analysis);
  const dashboardData = getDashboardData();
  const assetIndex = readMediaAssetIndex();

  if (assetIndex) {
    buildMediaAssetSummaries({
      usages: dashboardData.tweetUsages,
      assetIndex
    });
  }

  return {
    usageId: buildUsageId(usage.tweet, usage.mediaIndex),
    filePath,
    indexedCount: indexResult.indexedCount,
    analysis
  };
}
