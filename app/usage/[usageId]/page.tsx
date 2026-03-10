import { notFound } from "next/navigation";
import { AnalysisDetail } from "@/src/components/analysis-detail";
import { getUsageDetail } from "@/src/server/usage-details";

export default async function UsageDetailPage({
  params
}: {
  params: Promise<{ usageId: string }>;
}) {
  const { usageId } = await params;
  const detail = getUsageDetail(usageId);

  if (!detail) {
    notFound();
  }

  const media = detail.tweet.media[detail.mediaIndex];

  return (
    <AnalysisDetail
      usageId={detail.usageId}
      tweet={{
        tweetUrl: detail.tweet.tweetUrl,
        text: detail.tweet.text,
        authorUsername: detail.tweet.authorUsername,
        createdAt: detail.tweet.createdAt
      }}
      media={{
        sourceUrl: media.sourceUrl,
        posterUrl: media.posterUrl,
        previewUrl: media.previewUrl,
        mediaKind: media.mediaKind
      }}
      orderedFacets={detail.orderedFacets}
      mediaAssetView={detail.mediaAssetView}
    />
  );
}
