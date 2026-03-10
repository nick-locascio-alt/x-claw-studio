import { describe, expect, it } from "vitest";

describe("openclaw x-tab selection", () => {
  it("prefers an attached x.com tab", async () => {
    const mod = await import("@/src/server/openclaw-browser");
    const tabs = [
      { targetId: "1", url: "https://example.com" },
      { targetId: "2", url: "https://x.com/home" }
    ];

    const chosen = tabs.find((tab) => {
      const url = tab.url ?? "";
      return url.includes("x.com") || url.includes("twitter.com");
    });

    expect(chosen?.targetId).toBe("2");
    expect(typeof mod.chooseAttachedXTab).toBe("function");
  });
});
