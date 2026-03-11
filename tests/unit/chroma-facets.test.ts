import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TweetUsageRecord, UsageAnalysis } from "@/src/lib/types";

const mockUsages: TweetUsageRecord[] = [];
const mockAnalyses: UsageAnalysis[] = [];

vi.mock("@/src/server/data", () => ({
  getDashboardData: () => ({
    tweetUsages: mockUsages
  })
}));

vi.mock("@/src/server/analysis-store", () => ({
  readAllUsageAnalyses: () => mockAnalyses
}));

vi.mock("chromadb", () => ({
  ChromaClient: class {
    async getOrCreateCollection() {
      return {
        async query() {
          return {
            ids: [[]],
            documents: [[]],
            metadatas: [[]],
            distances: [[]]
          };
        },
        async upsert() {
          return undefined;
        }
      };
    }
  }
}));

vi.mock("@google/genai", () => ({
  Type: {
    OBJECT: "OBJECT",
    STRING: "STRING",
    INTEGER: "INTEGER",
    BOOLEAN: "BOOLEAN",
    ARRAY: "ARRAY"
  },
  GoogleGenAI: class {
    models = {
      embedContent: vi.fn(async () => ({
        embeddings: [{ values: [0.1, 0.2, 0.3] }]
      }))
    };
  }
}));

function createAnalysis(index: number): UsageAnalysis {
  return {
    usageId: `usage-${index}`,
    tweetId: `tweet-${index}`,
    mediaIndex: 0,
    mediaKind: "image",
    status: "complete",
    has_celebrity: false,
    has_human_face: true,
    features_female: false,
    features_male: true,
    has_screenshot_ui: true,
    has_text_overlay: false,
    has_chart_or_graph: true,
    has_logo_or_watermark: false,
    caption_brief: `Terminal dashboard capture ${index}`,
    scene_description: "Operators reviewing a market dashboard.",
    ocr_text: "ALERT MODE",
    primary_subjects: ["operator"],
    secondary_subjects: ["dashboard"],
    visible_objects: ["monitor", "chart"],
    setting_context: "trading desk",
    action_or_event: "monitoring",
    video_music: null,
    video_sound: null,
    video_action: null,
    primary_emotion: "focus",
    emotional_tone: "analytical",
    conveys: `signal-${index}`,
    user_intent: "educate",
    rhetorical_role: "evidence",
    text_media_relationship: "supports the claim",
    metaphor: null,
    humor_mechanism: null,
    cultural_reference: null,
    reference_entity: null,
    reference_source: null,
    reference_plot_context: null,
    analogy_target: null,
    analogy_scope: null,
    meme_format: null,
    persuasion_strategy: "clarity",
    brand_signals: [],
    trend_signal: "market ops",
    reuse_pattern: "dashboard reuse",
    why_it_works: "dense proof",
    audience_takeaway: "the dashboard is active",
    search_keywords: ["dashboard", "terminal"],
    confidence_notes: "fixture",
    usage_notes: "fixture"
  };
}

function createUsage(index: number): TweetUsageRecord {
  const analysis = createAnalysis(index);

  return {
    usageId: analysis.usageId,
    tweet: {
      sourceName: "fixture",
      tweetId: analysis.tweetId,
      tweetUrl: null,
      authorHandle: "@fixture",
      authorUsername: `fixture-${index}`,
      authorDisplayName: `Fixture ${index}`,
      authorProfileImageUrl: null,
      createdAt: null,
      text: `Terminal dashboard screenshot ${index}`,
      metrics: { replies: null, reposts: null, likes: null, bookmarks: null, views: null },
      media: [{ mediaKind: "image", sourceUrl: null, previewUrl: null, posterUrl: null }],
      extraction: { articleIndex: 0, extractedAt: new Date("2026-03-10T12:00:00.000Z").toISOString() }
    },
    mediaIndex: 0,
    analysis,
    mediaAssetId: `asset-${index}`,
    mediaLocalFilePath: null,
    mediaPlayableFilePath: null,
    mediaAssetStarred: false,
    mediaAssetUsageCount: 1,
    phashMatchCount: 0,
    duplicateGroupId: null,
    duplicateGroupUsageCount: 1,
    hotnessScore: 0
  };
}

describe("searchFacetIndex", () => {
  beforeEach(() => {
    mockUsages.length = 0;
    mockAnalyses.length = 0;
  });

  it("uses enriched lexical documents beyond raw facet values", async () => {
    const usage = createUsage(1);
    mockUsages.push(usage);
    mockAnalyses.push(usage.analysis);

    const { searchFacetIndex } = await import("@/src/server/chroma-facets");
    const result = await searchFacetIndex({
      query: "dashboard terminal",
      facetName: "conveys"
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.document).toContain("tweet_text: Terminal dashboard screenshot 1");
    expect(result.results[0]?.document).toContain("search_keywords: dashboard, terminal");
  });

  it("defaults to 20 results when no limit is provided", async () => {
    for (let index = 1; index <= 25; index += 1) {
      const usage = createUsage(index);
      mockUsages.push(usage);
      mockAnalyses.push(usage.analysis);
    }

    const { searchFacetIndex } = await import("@/src/server/chroma-facets");
    const result = await searchFacetIndex({
      query: "dashboard",
      facetName: "conveys"
    });

    expect(result.limit).toBe(20);
    expect(result.results).toHaveLength(20);
  });
});
