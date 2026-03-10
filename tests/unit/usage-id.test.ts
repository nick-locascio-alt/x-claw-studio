import { describe, expect, it } from "vitest";
import { buildUsageId } from "@/src/lib/usage-id";

describe("buildUsageId", () => {
  it("builds a deterministic usage id from tweet id and media index", () => {
    const usageId = buildUsageId(
      {
        sourceName: "sample",
        tweetId: "123",
        tweetUrl: null,
        authorHandle: null,
        authorUsername: null,
        authorDisplayName: null,
        authorProfileImageUrl: null,
        createdAt: null,
        text: null,
        metrics: {
          replies: null,
          reposts: null,
          likes: null,
          bookmarks: null,
          views: null
        },
        media: [],
        extraction: {
          articleIndex: 0,
          extractedAt: "2026-03-09T00:00:00.000Z"
        }
      },
      2
    );

    expect(usageId).toBe("123-2");
  });
});
