import { ANALYSIS_FACET_NAMES, type AnalysisFacetName } from "@/src/lib/analysis-schema";
import { getDashboardData } from "@/src/server/data";
import { getMediaAssetView } from "@/src/server/media-assets";
import type { MediaAssetView } from "@/src/lib/types";

export function getUsageDetail(usageId: string): (ReturnType<typeof getDashboardData>["tweetUsages"][number] & {
  mediaAssetView: MediaAssetView | null;
  orderedFacets: Array<{ name: string; value: ReturnType<typeof getDashboardData>["tweetUsages"][number]["analysis"][AnalysisFacetName] }>;
}) | null {
  const data = getDashboardData();
  const match = data.tweetUsages.find((usage) => usage.usageId === usageId);

  if (!match) {
    return null;
  }

  const orderedFacets = ANALYSIS_FACET_NAMES.map((name) => ({
    name,
    value: match.analysis[name as AnalysisFacetName]
  }));

  return {
    ...match,
    mediaAssetView: getMediaAssetView({
      usageId,
      usages: data.tweetUsages
    }),
    orderedFacets
  };
}
