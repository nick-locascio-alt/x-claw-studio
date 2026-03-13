import { describe, expect, it } from "vitest";
import { resolveOpenClawCurrentCapturePlan } from "@/src/server/openclaw-current-capture";

describe("resolveOpenClawCurrentCapturePlan", () => {
  it("keeps the full current-page capture behavior by default", () => {
    const plan = resolveOpenClawCurrentCapturePlan({
      mode: "current_page",
      openclawStartUrl: null,
      maxScrolls: 12,
      tweetPageMaxScrolls: 5
    });

    expect(plan).toEqual({
      effectiveMaxScrolls: 12,
      captureTweetLimit: 10,
      stopAfterUniqueTweets: null,
      forceScrollToTop: false
    });
  });

  it("caps tweet-thread capture and stops after the early replies", () => {
    const plan = resolveOpenClawCurrentCapturePlan({
      mode: "tweet_thread",
      openclawStartUrl: "https://x.com/example/status/123",
      maxScrolls: 60,
      tweetPageMaxScrolls: 5,
      focusedMaxScrolls: 3,
      focusedTargetCount: 11
    });

    expect(plan).toEqual({
      effectiveMaxScrolls: 3,
      captureTweetLimit: 12,
      stopAfterUniqueTweets: 11,
      forceScrollToTop: true
    });
  });

  it("still bounds status-url current-page capture when not using focused mode", () => {
    const plan = resolveOpenClawCurrentCapturePlan({
      mode: "current_page",
      openclawStartUrl: "https://x.com/example/status/123",
      maxScrolls: 60,
      tweetPageMaxScrolls: 5
    });

    expect(plan.effectiveMaxScrolls).toBe(5);
    expect(plan.stopAfterUniqueTweets).toBeNull();
  });
});
