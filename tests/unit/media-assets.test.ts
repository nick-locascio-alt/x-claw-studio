import { describe, expect, it } from "vitest";
import { hammingDistanceHex } from "@/src/server/media-fingerprint";
import { summarizeAnalyses } from "@/src/server/media-assets";
import type { UsageAnalysis } from "@/src/lib/types";

function buildAnalysis(overrides: Partial<UsageAnalysis>): UsageAnalysis {
  return {
    usageId: "usage-1",
    tweetId: "tweet-1",
    mediaIndex: 0,
    mediaKind: "image",
    status: "complete",
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
    usage_notes: null,
    ...overrides
  };
}

describe("media fingerprint helpers", () => {
  it("computes hamming distance from two hex hashes", () => {
    expect(hammingDistanceHex("ffffffffffffffff", "ffffffffffffffff")).toBe(0);
    expect(hammingDistanceHex("ffffffffffffffff", "0000000000000000")).toBe(64);
  });
});

describe("summarizeAnalyses", () => {
  it("falls back to the first complete analysis when no aggregate exists", () => {
    const first = buildAnalysis({ usageId: "usage-a", conveys: "sarcastic approval" });
    const summary = summarizeAnalyses("asset-1", [first]);

    expect(summary.status).toBe("fallback_first_analysis");
    expect(summary.sourceUsageId).toBe("usage-a");
    expect(summary.summary?.conveys).toBe("sarcastic approval");
  });

  it("aggregates multiple complete analyses", () => {
    const first = buildAnalysis({
      usageId: "usage-a",
      conveys: "dread",
      user_intent: "signal urgency",
      primary_subjects: ["server rack"],
      primary_emotion: "anxiety"
    });
    const second = buildAnalysis({
      usageId: "usage-b",
      conveys: "dread",
      user_intent: "signal urgency",
      primary_subjects: ["operator"],
      metaphor: "machine panic",
      primary_emotion: "anxiety"
    });

    const summary = summarizeAnalyses("asset-2", [first, second]);

    expect(summary.status).toBe("aggregated");
    expect(summary.summary?.conveys).toBe("dread");
    expect(summary.summary?.user_intent).toBe("signal urgency");
    expect(summary.summary?.primary_subjects).toEqual(["server rack", "operator"]);
    expect(summary.summary?.primary_emotion).toBe("anxiety");
    expect(summary.summary?.metaphor).toBe("machine panic");
  });

  it("aggregates boolean labels with any-true semantics", () => {
    const first = buildAnalysis({
      usageId: "usage-a",
      has_screenshot_ui: true,
      has_chart_or_graph: false,
      features_female: true
    });
    const second = buildAnalysis({
      usageId: "usage-b",
      has_screenshot_ui: false,
      has_chart_or_graph: true,
      features_male: true
    });

    const summary = summarizeAnalyses("asset-3", [first, second]);

    expect(summary.summary?.has_screenshot_ui).toBe(true);
    expect(summary.summary?.has_chart_or_graph).toBe(true);
    expect(summary.summary?.has_celebrity).toBe(false);
    expect(summary.summary?.features_female).toBe(true);
    expect(summary.summary?.features_male).toBe(true);
  });
});
