import { describe, expect, it } from "vitest";
import { buildPhashMatchMap } from "@/src/server/media-assets";
import type { MediaAssetRecord, TweetUsageRecord } from "@/src/lib/types";

function buildUsage(usageId: string, mediaAssetId: string): TweetUsageRecord {
  return {
    usageId,
    mediaAssetId,
    mediaLocalFilePath: null,
    mediaAssetStarred: false,
    mediaAssetUsageCount: 1,
    phashMatchCount: 0,
    mediaIndex: 0,
    tweet: {
      sourceName: "test",
      tweetId: usageId,
      tweetUrl: null,
      authorHandle: null,
      authorUsername: "@tester",
      authorDisplayName: null,
      authorProfileImageUrl: null,
      createdAt: null,
      text: "test tweet",
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
          sourceUrl: null,
          previewUrl: null,
          posterUrl: null
        }
      ],
      extraction: {
        articleIndex: 0,
        extractedAt: new Date(0).toISOString()
      }
    },
    analysis: {
      usageId,
      tweetId: usageId,
      mediaIndex: 0,
      mediaKind: "image",
      status: "pending",
      has_celebrity: null,
      has_human_face: null,
      features_female: null,
      features_male: null,
      has_screenshot_ui: null,
      has_text_overlay: null,
      has_chart_or_graph: null,
      has_logo_or_watermark: null,
      caption_brief: null,
      scene_description: null,
      ocr_text: null,
      primary_subjects: [],
      secondary_subjects: [],
      visible_objects: [],
      setting_context: null,
      action_or_event: null,
      primary_emotion: null,
      emotional_tone: null,
      conveys: null,
      user_intent: null,
      rhetorical_role: null,
      text_media_relationship: null,
      metaphor: null,
      humor_mechanism: null,
      cultural_reference: null,
      meme_format: null,
      persuasion_strategy: null,
      brand_signals: [],
      trend_signal: null,
      reuse_pattern: null,
      why_it_works: null,
      audience_takeaway: null,
      search_keywords: [],
      confidence_notes: null,
      usage_notes: null
    }
  };
}

function buildAsset(assetId: string, hex: string): MediaAssetRecord {
  return {
    assetId,
    canonicalMediaUrl: null,
    canonicalFilePath: null,
    mediaKind: "image",
    fingerprint: {
      algorithm: "dhash_8x8",
      hex,
      bitLength: 64,
      width: 8,
      height: 8
    },
    starred: false,
    usageIds: [`${assetId}-usage`],
    sourceUrls: [],
    previewUrls: [],
    posterUrls: [],
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  };
}

describe("buildPhashMatchMap", () => {
  it("returns nearby matches across distinct assets ordered by distance", () => {
    const assets = [
      buildAsset("asset-a", "0000000000000000"),
      buildAsset("asset-b", "0000000000000001"),
      buildAsset("asset-c", "0000000000000003"),
      buildAsset("asset-d", "ffffffffffffffff")
    ];
    const usages = [
      buildUsage("asset-a-usage", "asset-a"),
      buildUsage("asset-b-usage", "asset-b"),
      buildUsage("asset-c-usage", "asset-c"),
      buildUsage("asset-d-usage", "asset-d")
    ];

    const result = buildPhashMatchMap({ assets, usages, maxDistance: 2 });

    expect(result["asset-a"].map((match) => [match.asset.assetId, match.distance])).toEqual([
      ["asset-b", 1],
      ["asset-c", 2]
    ]);
    expect(result["asset-d"]).toEqual([]);
  });
});
