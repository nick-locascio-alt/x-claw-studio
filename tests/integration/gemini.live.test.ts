import { beforeAll, describe, expect, it } from "vitest";

const runLive =
  Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) &&
  process.env.LIVE_GEMINI_TESTS === "1";
const describeLive = runLive ? describe : describe.skip;

describeLive("Gemini live integration", () => {
  beforeAll(() => {
    process.env.GEMINI_ANALYSIS_MODEL ||= "gemini-3.1-flash-lite-preview";
  });

  it("analyzes one real tweet media usage with Gemini", async () => {
    const { findTweetUsage } = await import("@/src/server/tweet-repository");
    const { analyzeTweetMediaUsage } = await import("@/src/server/gemini-analysis");

    const usage = findTweetUsage("2030602059712471112", 0);
    expect(usage).not.toBeNull();

    const analysis = await analyzeTweetMediaUsage(usage!.tweet, usage!.mediaIndex);
    expect(analysis.status).toBe("complete");
    expect(analysis.caption_brief || analysis.scene_description).toBeTruthy();
  }, 60_000);
});
