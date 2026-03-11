import { describe, expect, it } from "vitest";
import { computeHotnessScore, parseCompactNumber } from "@/src/server/data";

describe("parseCompactNumber", () => {
  it("parses compact and comma-separated counts", () => {
    expect(parseCompactNumber("987")).toBe(987);
    expect(parseCompactNumber("1,234")).toBe(1234);
    expect(parseCompactNumber("2.5K")).toBe(2500);
    expect(parseCompactNumber("1.2M")).toBe(1_200_000);
  });

  it("falls back to zero for empty or invalid values", () => {
    expect(parseCompactNumber(null)).toBe(0);
    expect(parseCompactNumber("not-a-number")).toBe(0);
  });
});

describe("computeHotnessScore", () => {
  it("rewards more duplicates and likes at the same timestamp", () => {
    const nowMs = Date.parse("2026-03-10T12:00:00.000Z");
    const baseline = computeHotnessScore({
      duplicateCount: 1,
      totalLikes: 10,
      mostRecentTimestampMs: nowMs,
      nowMs
    });
    const hotter = computeHotnessScore({
      duplicateCount: 4,
      totalLikes: 500,
      mostRecentTimestampMs: nowMs,
      nowMs
    });

    expect(hotter).toBeGreaterThan(baseline);
  });

  it("decays older activity even when engagement is unchanged", () => {
    const nowMs = Date.parse("2026-03-10T12:00:00.000Z");
    const fresh = computeHotnessScore({
      duplicateCount: 3,
      totalLikes: 120,
      mostRecentTimestampMs: nowMs - 2 * 60 * 60 * 1000,
      nowMs
    });
    const stale = computeHotnessScore({
      duplicateCount: 3,
      totalLikes: 120,
      mostRecentTimestampMs: nowMs - 7 * 24 * 60 * 60 * 1000,
      nowMs
    });

    expect(fresh).toBeGreaterThan(stale);
  });
});
