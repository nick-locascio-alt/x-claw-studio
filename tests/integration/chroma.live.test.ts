import { describe, expect, it } from "vitest";

const runLive = Boolean(process.env.CHROMA_URL) && process.env.LIVE_CHROMA_TESTS === "1";
const describeLive = runLive ? describe : describe.skip;

describeLive("Chroma live integration", () => {
  it("indexes and searches one synthetic usage analysis", async () => {
    process.env.CHROMA_COLLECTION = `twitter_trend_facets_test_${Date.now()}`;
    const { indexUsageAnalysisInChroma, searchFacetIndex } = await import("@/src/server/chroma-facets");

    const result = await indexUsageAnalysisInChroma(
      {
        sourceName: "synthetic",
        tweetId: "synthetic-1",
        tweetUrl: null,
        authorHandle: "@tester",
        authorUsername: "@tester",
        authorDisplayName: "Tester",
        authorProfileImageUrl: null,
        createdAt: null,
        text: "This image is used to signal panic in a monitoring room.",
        metrics: { replies: null, reposts: null, likes: null, bookmarks: null, views: null },
        media: [],
        extraction: { articleIndex: 0, extractedAt: new Date().toISOString() }
      },
      {
        usageId: "synthetic-1-0",
        tweetId: "synthetic-1",
        mediaIndex: 0,
        mediaKind: "image",
        status: "complete",
        has_celebrity: false,
        has_human_face: true,
        features_female: false,
        features_male: true,
        has_screenshot_ui: false,
        has_text_overlay: false,
        has_chart_or_graph: false,
        has_logo_or_watermark: false,
        caption_brief: "A tense reaction image.",
        scene_description: "A person staring at screens.",
        ocr_text: null,
        primary_subjects: ["person"],
        secondary_subjects: ["screen"],
        visible_objects: ["monitor"],
        setting_context: "control room",
        action_or_event: "monitoring",
        video_music: null,
        video_sound: null,
        video_action: null,
        primary_emotion: "anxiety",
        emotional_tone: "anxious",
        conveys: "panic",
        user_intent: "warn the audience",
        rhetorical_role: "reaction",
        text_media_relationship: "supports the panic claim",
        metaphor: "surveillance as pressure",
        humor_mechanism: null,
        cultural_reference: null,
        reference_entity: null,
        reference_source: null,
        reference_plot_context: null,
        analogy_target: null,
        analogy_scope: null,
        meme_format: null,
        persuasion_strategy: "urgency",
        brand_signals: [],
        trend_signal: "works as a general alarm template",
        reuse_pattern: "reused in warning posts",
        why_it_works: "highly legible emotion",
        audience_takeaway: "situation is alarming",
        search_keywords: ["panic", "surveillance"],
        confidence_notes: "synthetic fixture",
        usage_notes: "synthetic fixture"
      }
    );

    expect(result.indexedCount).toBeGreaterThan(0);

    const search = await searchFacetIndex({
      query: "panic surveillance reaction",
      facetName: "conveys",
      limit: 3
    });

    expect(search.results.length).toBeGreaterThan(0);
  }, 60_000);
});
