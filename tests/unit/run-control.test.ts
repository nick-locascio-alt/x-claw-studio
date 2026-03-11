import { describe, expect, it } from "vitest";

describe("run-control scheduler slot selection", () => {
  it("triggers on the current scheduled minute", async () => {
    const { findLatestDueScheduleSlot } = await import("@/src/server/run-control");

    const dueSlot = findLatestDueScheduleSlot(
      new Date("2026-03-10T21:12:00.000Z"),
      "America/Los_Angeles",
      ["14:12"],
      null
    );

    expect(dueSlot).toBe("2026-03-10T21:12:00.000Z");
  });

  it("catches up the latest missed slot after a polling gap", async () => {
    const { findLatestDueScheduleSlot } = await import("@/src/server/run-control");

    const dueSlot = findLatestDueScheduleSlot(
      new Date("2026-03-11T02:58:00.000Z"),
      "America/Los_Angeles",
      ["10:25", "12:47", "14:12", "15:02", "18:34", "22:19"],
      "2026-03-10T22:02:00.000Z"
    );

    expect(dueSlot).toBe("2026-03-11T01:34:00.000Z");
  });

  it("does not re-trigger a slot that was already processed", async () => {
    const { findLatestDueScheduleSlot } = await import("@/src/server/run-control");

    const dueSlot = findLatestDueScheduleSlot(
      new Date("2026-03-11T01:50:00.000Z"),
      "America/Los_Angeles",
      ["18:34"],
      "2026-03-11T01:34:00.000Z"
    );

    expect(dueSlot).toBeNull();
  });

  it("limits first-run catch-up to the current local day", async () => {
    const { findLatestDueScheduleSlot } = await import("@/src/server/run-control");

    const dueSlot = findLatestDueScheduleSlot(
      new Date("2026-03-11T02:58:00.000Z"),
      "America/Los_Angeles",
      ["10:25", "12:47", "14:12", "15:02", "18:34", "22:19"],
      null
    );

    expect(dueSlot).toBe("2026-03-11T01:34:00.000Z");
  });
});
