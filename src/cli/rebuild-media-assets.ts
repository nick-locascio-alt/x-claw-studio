import "@/src/lib/env";
import { getDashboardData } from "@/src/server/data";
import { buildMediaAssetIndex, buildMediaAssetSummaries } from "@/src/server/media-assets";

async function main() {
  const data = getDashboardData();
  const index = await buildMediaAssetIndex({
    usages: data.tweetUsages,
    manifests: data.manifests
  });
  const summaries = buildMediaAssetSummaries({
    usages: data.tweetUsages,
    assetIndex: index
  });

  console.log(
    JSON.stringify(
      {
        assetCount: index.assets.length,
        usageCount: data.tweetUsages.length,
        summaryCount: summaries.summaries.length
      },
      null,
      2
    )
  );
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
