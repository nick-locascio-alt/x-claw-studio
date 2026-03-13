import { describe, expect, it } from "vitest";
import { buildTweetMediaAnalysisPrompt, buildVideoAssetAnalysisPrompt } from "@/src/server/gemini-analysis-prompt";
import type { ExtractedTweet } from "@/src/lib/types";

const fixtureTweet: ExtractedTweet = {
  sourceName: "fixture",
  tweetId: "tweet-1",
  tweetUrl: "https://x.com/example/status/1",
  authorHandle: "@example",
  authorUsername: "@example",
  authorDisplayName: "Example",
  authorProfileImageUrl: null,
  createdAt: "2026-03-10T00:00:00.000Z",
  text: "just woke up to jianyang distilling claude in the basement again.",
  metrics: {
    replies: "1",
    reposts: "2",
    likes: "3",
    bookmarks: "4",
    views: "5"
  },
  media: [
    {
      mediaKind: "image",
      sourceUrl: "https://pbs.twimg.com/media/example.jpg",
      previewUrl: "https://pbs.twimg.com/media/example.jpg",
      posterUrl: "https://pbs.twimg.com/media/example.jpg"
    }
  ],
  extraction: {
    articleIndex: 0,
    extractedAt: "2026-03-10T00:00:00.000Z"
  }
};

describe("buildTweetMediaAnalysisPrompt", () => {
  it("includes cultural reference audit guidance in the default variant", () => {
    const prompt = buildTweetMediaAnalysisPrompt(fixtureTweet, 0);

    expect(prompt).toContain("Cultural reference audit:");
    expect(prompt).toContain("name the source material and character when grounded");
    expect(prompt).toContain("Do not stop at generic descriptions like 'shady hacker'");
  });

  it("omits the cultural reference audit in the baseline variant", () => {
    const prompt = buildTweetMediaAnalysisPrompt(fixtureTweet, 0, "baseline");

    expect(prompt).not.toContain("Cultural reference audit:");
    expect(prompt).toContain("Facet guidance:");
  });

  it("shares the same facet structure between usage media and video asset prompts", () => {
    const prompt = buildVideoAssetAnalysisPrompt({
      assetId: "asset-1",
      mediaKind: "video_blob",
      canonicalMediaUrl: "https://video.twimg.com/example.mp4",
      canonicalPosterUrl: "https://pbs.twimg.com/example.jpg",
      representativeUsageId: "tweet-1-0",
      representativeAuthorUsername: "@example",
      representativeTweetText: "example"
    });

    expect(prompt).toContain("Use the same facet structure as image analysis.");
    expect(prompt).toContain("reference_entity:");
    expect(prompt).toContain("video_music");
    expect(prompt).toContain("video_dialogue");
    expect(prompt).toContain("search_keywords:");
  });
});
