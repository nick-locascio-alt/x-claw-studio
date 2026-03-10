import { describe, expect, it } from "vitest";

const runLive =
  Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) &&
  Boolean(process.env.CHROMA_URL) &&
  process.env.LIVE_INTEGRATION_TESTS === "1";
const describeLive = runLive ? describe : describe.skip;

describeLive("Gemini + Chroma live integration", () => {
  it("analyzes a real usage and immediately indexes/searches it", async () => {
    process.env.CHROMA_COLLECTION = `twitter_trend_live_integration_${Date.now()}`;

    const { analyzeAndIndexTweetUsage } = await import("@/src/server/analysis-pipeline");
    const { searchFacetIndex } = await import("@/src/server/chroma-facets");

    const result = await analyzeAndIndexTweetUsage("2030602059712471112", 0);
    expect(result.indexedCount).toBeGreaterThan(0);

    const search = await searchFacetIndex({
      query: result.analysis.conveys || result.analysis.caption_brief || "surveillance",
      limit: 5
    });

    expect(search.results.length).toBeGreaterThan(0);
  }, 120_000);
});
