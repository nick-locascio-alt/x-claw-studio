import { describe, expect, it } from "vitest";
import { normalizeUsageAnalysis } from "@/src/lib/analysis-schema";

describe("normalizeUsageAnalysis", () => {
  it("normalizes and validates a complete analysis payload", () => {
    const analysis = normalizeUsageAnalysis({
      usageId: "tweet-1-0",
      tweetId: "tweet-1",
      mediaIndex: 0,
      mediaKind: "image",
      status: "complete",
      has_celebrity: false,
      has_human_face: true,
      features_female: false,
      features_male: true,
      has_screenshot_ui: false,
      has_text_overlay: true,
      has_chart_or_graph: false,
      has_logo_or_watermark: false,
      caption_brief: "A person stares at a dashboard.",
      scene_description: "A close-up of a person in front of multiple monitors.",
      ocr_text: "SYSTEM ALERT",
      primary_subjects: ["person"],
      secondary_subjects: ["dashboard"],
      visible_objects: ["monitor", "desk"],
      setting_context: "office",
      action_or_event: "watching alerts",
      video_music: null,
      video_sound: null,
      video_action: null,
      primary_emotion: "anxiety",
      emotional_tone: "tense",
      conveys: "heightened concern",
      user_intent: "to dramatize urgency",
      rhetorical_role: "reaction",
      text_media_relationship: "reinforces the warning in the text",
      metaphor: "surveillance as pressure",
      humor_mechanism: null,
      cultural_reference: null,
      reference_entity: null,
      reference_source: null,
      reference_plot_context: null,
      analogy_target: null,
      analogy_scope: null,
      meme_format: null,
      persuasion_strategy: "salience",
      brand_signals: [],
      trend_signal: "easy to reuse for panic posts",
      reuse_pattern: "used when posters want to imply crisis",
      why_it_works: "instantly readable tension",
      audience_takeaway: "something alarming is happening",
      search_keywords: ["panic", "monitoring"],
      confidence_notes: "high confidence on emotional tone",
      usage_notes: "none"
    });

    expect(analysis.rhetorical_role).toBe("reaction");
    expect(analysis.has_human_face).toBe(true);
    expect(analysis.primary_emotion).toBe("anxiety");
    expect(analysis.search_keywords).toContain("panic");
  });
});
