import { describe, expect, it } from "vitest";
import {
  choosePromotableHlsMasterUrl,
  choosePromotableVideoUrl,
  listPromotableVideoSources,
  materializeUsageAnalysisFromAssetVideo,
  parseFfmpegDurationSeconds
} from "@/src/server/media-asset-video";
import type { MediaAssetRecord, TweetUsageRecord, UsageAnalysis } from "@/src/lib/types";

function buildVideoAsset(sourceUrls: string[]): MediaAssetRecord {
  return {
    assetId: "asset-video",
    canonicalMediaUrl: null,
    canonicalFilePath: null,
    promotedVideoSourceUrl: null,
    promotedVideoFilePath: null,
    mediaKind: "video_blob",
    fingerprint: null,
    similarityEmbedding: null,
    starred: false,
    usageIds: [],
    sourceUrls,
    previewUrls: [],
    posterUrls: [],
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  };
}

function buildVideoAnalysis(): UsageAnalysis {
  return {
    usageId: "asset-video::video",
    tweetId: null,
    mediaIndex: 0,
    mediaKind: "video",
    status: "complete",
    has_celebrity: false,
    has_human_face: true,
    features_female: false,
    features_male: true,
    has_screenshot_ui: false,
    has_text_overlay: false,
    has_chart_or_graph: false,
    has_logo_or_watermark: false,
    caption_brief: "A founder talks to camera.",
    scene_description: "A short startup-style video.",
    ocr_text: null,
    primary_subjects: ["founder"],
    secondary_subjects: [],
    visible_objects: ["camera"],
    setting_context: "office",
    action_or_event: "talking",
    video_music: "no music",
    video_sound: "spoken dialogue",
    video_dialogue: "I can't do this anymore.",
    video_action: "a person speaks directly to camera with minimal movement",
    primary_emotion: "confidence",
    emotional_tone: "deadpan",
    conveys: "bootleg startup energy",
    user_intent: "mock startup cloning",
    rhetorical_role: "meme",
    text_media_relationship: "reinforce",
    metaphor: "copycat startup as local model distillation",
    humor_mechanism: "character-based reference",
    cultural_reference: "Silicon Valley",
    reference_entity: "Jian-Yang",
    reference_source: "Silicon Valley",
    reference_plot_context: "copycat startup behavior",
    analogy_target: "AI model distillation",
    analogy_scope: "company",
    meme_format: "reaction image",
    persuasion_strategy: "identification",
    brand_signals: [],
    trend_signal: "AI",
    reuse_pattern: "clone jokes",
    why_it_works: "specific callback",
    audience_takeaway: "someone is cloning a model",
    search_keywords: ["Jian-Yang", "AI distillation"],
    confidence_notes: "fixture",
    usage_notes: "fixture"
  };
}

function buildUsage(): TweetUsageRecord {
  return {
    usageId: "tweet-1-0",
    mediaAssetId: "asset-video",
    mediaLocalFilePath: null,
    mediaPlayableFilePath: "data/analysis/media-assets/videos/asset-video.mp4",
    mediaAssetStarred: false,
    mediaAssetUsageCount: 1,
    phashMatchCount: 0,
    duplicateGroupId: "asset-video",
    duplicateGroupUsageCount: 1,
    hotnessScore: 0,
    mediaIndex: 0,
    tweet: {
      sourceName: "test",
      tweetId: "tweet-1",
      tweetUrl: null,
      authorHandle: "@tester",
      authorUsername: "@tester",
      authorDisplayName: "Tester",
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
      media: [{ mediaKind: "video_blob", sourceUrl: null, previewUrl: null, posterUrl: null }],
      extraction: {
        articleIndex: 0,
        extractedAt: new Date(0).toISOString()
      }
    },
    analysis: buildVideoAnalysis()
  };
}

describe("choosePromotableVideoUrl", () => {
  it("rejects init-fragment mp4 URLs that are not full videos", () => {
    const asset = buildVideoAsset([
      "https://video.twimg.com/amplify_video/2031389215028899840/aud/mp4a/0/0/32000/o7me5vf759ZCwxwS.mp4",
      "https://video.twimg.com/amplify_video/2031389215028899840/vid/avc1/0/0/1920x1080/KbE0mEMLj8D2KtZj.mp4"
    ]);

    expect(choosePromotableVideoUrl(asset)).toBeNull();
  });

  it("returns null when only manifests and audio fragments are available", () => {
    const asset = buildVideoAsset([
      "https://video.twimg.com/amplify_video/2031389215028899840/pl/CU7WoeaiUJ2YFKH0.m3u8?variant_version=1&tag=21&v=cfc",
      "https://video.twimg.com/amplify_video/2031389215028899840/aud/mp4a/0/0/128000/vTzHgVTi3oomeJLh.mp4",
      "https://video.twimg.com/amplify_video/2031389215028899840/vid/avc1/0/3000/1920x1080/pVY8OSPILjYB2-YJ.m4s"
    ]);

    expect(choosePromotableVideoUrl(asset)).toBeNull();
  });

  it("falls back to the HLS master playlist when direct mp4 promotion is unsafe", () => {
    const asset = buildVideoAsset([
      "https://video.twimg.com/amplify_video/2031389215028899840/pl/CU7WoeaiUJ2YFKH0.m3u8?variant_version=1&tag=21&v=cfc",
      "https://video.twimg.com/amplify_video/2031389215028899840/vid/avc1/0/0/1920x1080/KbE0mEMLj8D2KtZj.mp4"
    ]);

    expect(choosePromotableHlsMasterUrl(asset)).toBe(
      "https://video.twimg.com/amplify_video/2031389215028899840/pl/CU7WoeaiUJ2YFKH0.m3u8?variant_version=1&tag=21&v=cfc"
    );
  });
});

describe("listPromotableVideoSources", () => {
  it("tries a safe direct mp4 before falling back to the HLS master", () => {
    const asset = buildVideoAsset([
      "https://video.twimg.com/amplify_video/2031389215028899840/pl/CU7WoeaiUJ2YFKH0.m3u8?variant_version=1&tag=21&v=cfc",
      "https://video.twimg.com/amplify_video/2031389215028899840/vid/avc1/480x852/example.mp4"
    ]);

    expect(listPromotableVideoSources(asset)).toEqual([
      "https://video.twimg.com/amplify_video/2031389215028899840/vid/avc1/480x852/example.mp4",
      "https://video.twimg.com/amplify_video/2031389215028899840/pl/CU7WoeaiUJ2YFKH0.m3u8?variant_version=1&tag=21&v=cfc"
    ]);
  });

  it("drops an invalid remembered source and keeps the remaining safe fallback", () => {
    const asset = buildVideoAsset([
      "https://video.twimg.com/amplify_video/2031389215028899840/pl/CU7WoeaiUJ2YFKH0.m3u8?variant_version=1&tag=21&v=cfc"
    ]);
    asset.promotedVideoSourceUrl =
      "https://video.twimg.com/amplify_video/2031389215028899840/vid/avc1/0/0/1920x1080/KbE0mEMLj8D2KtZj.mp4";

    expect(listPromotableVideoSources(asset)).toEqual([
      "https://video.twimg.com/amplify_video/2031389215028899840/pl/CU7WoeaiUJ2YFKH0.m3u8?variant_version=1&tag=21&v=cfc"
    ]);
  });
});

describe("materializeUsageAnalysisFromAssetVideo", () => {
  it("projects asset video analysis onto a usage id and media kind", () => {
    const analysis = materializeUsageAnalysisFromAssetVideo(buildVideoAnalysis(), buildUsage());

    expect(analysis.usageId).toBe("tweet-1-0");
    expect(analysis.tweetId).toBe("tweet-1");
    expect(analysis.mediaKind).toBe("video_blob");
    expect(analysis.reference_entity).toBe("Jian-Yang");
    expect(analysis.usage_notes).toContain("Derived from promoted asset video analysis.");
  });
});

describe("parseFfmpegDurationSeconds", () => {
  it("parses ffmpeg duration output into seconds", () => {
    expect(parseFfmpegDurationSeconds("Duration: 00:04:59.50, start: 0.000000, bitrate: 1200 kb/s")).toBe(299.5);
    expect(parseFfmpegDurationSeconds("Duration: 00:05:01.00, start: 0.000000, bitrate: 1200 kb/s")).toBe(301);
  });

  it("returns null when duration is not present", () => {
    expect(parseFfmpegDurationSeconds("no duration here")).toBeNull();
  });
});
