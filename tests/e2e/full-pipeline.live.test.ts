import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { getDashboardData } from "@/src/server/data";

const execFileAsync = promisify(execFile);

const runLive =
  Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) &&
  Boolean(process.env.CHROMA_URL) &&
  process.env.LIVE_E2E_TESTS === "1";
const describeLive = runLive ? describe : describe.skip;

describeLive("full pipeline e2e", () => {
  it("analyzes one existing crawled tweet usage, then searches the facet index", async () => {
    process.env.CHROMA_COLLECTION = `twitter_trend_e2e_${Date.now()}`;
    const usage = getDashboardData().tweetUsages.find((entry) => entry.tweet.tweetId);
    if (!usage?.tweet.tweetId) {
      throw new Error("No crawled tweet usage available for e2e test.");
    }

    const analyze = await execFileAsync(
      "npm",
      ["run", "analyze:tweet", "--", usage.tweet.tweetId, String(usage.mediaIndex)],
      { cwd: process.cwd(), env: process.env }
    );
    expect(analyze.stdout).toContain("usageId");

    const search = await execFileAsync(
      "npm",
      ["run", "search:facets", "--", "surveillance router body pose", "scene_description"],
      { cwd: process.cwd(), env: process.env }
    );
    expect(search.stdout).toContain("scene_description");
  }, 180_000);
});
