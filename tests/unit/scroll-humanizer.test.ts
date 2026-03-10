import {
  buildCapturePauseAction,
  buildRefreshStartActions,
  buildScrollCycleActions
} from "@/src/lib/scroll-humanizer";
import { describe, expect, it } from "vitest";

function createRandom(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? 0;
}

describe("scroll humanizer", () => {
  it("jittered capture pause stays within the configured range", () => {
    const action = buildCapturePauseAction({
      capturePauseMs: 5000,
      random: createRandom([0])
    });

    expect(action).toEqual({ kind: "wait", ms: 3250 });
  });

  it("adds a refresh settling pause before capture begins", () => {
    const actions = buildRefreshStartActions({
      capturePauseMs: 5000,
      refreshSettlingMsMin: 1000,
      refreshSettlingMsMax: 2000,
      random: createRandom([0.5])
    });

    expect(actions).toEqual([{ kind: "wait", ms: 1500 }]);
  });

  it("mixes downward and occasional upward scroll actions", () => {
    const actions = buildScrollCycleActions({
      capturePauseMs: 5000,
      scrollStepMinPx: 300,
      scrollStepMaxPx: 300,
      scrollStepPauseMinMs: 600,
      scrollStepPauseMaxMs: 600,
      wheelTickMinPx: 100,
      wheelTickMaxPx: 100,
      wheelTickPauseMinMs: 20,
      wheelTickPauseMaxMs: 20,
      wheelReverseTickChance: 0,
      upwardScrollChance: 0.5,
      upwardScrollRatioMin: 0.5,
      upwardScrollRatioMax: 0.5,
      random: createRandom([0, 0, 0, 0.2, 0, 0, 0, 0])
    });

    expect(actions).toEqual([
      { kind: "wheel", deltaY: 100 },
      { kind: "wait", ms: 20 },
      { kind: "wheel", deltaY: 100 },
      { kind: "wait", ms: 20 },
      { kind: "wheel", deltaY: 100 },
      { kind: "wait", ms: 20 },
      { kind: "wait", ms: 600 },
      { kind: "wheel", deltaY: -100 },
      { kind: "wait", ms: 20 },
      { kind: "wheel", deltaY: -50 },
      { kind: "wait", ms: 20 },
      { kind: "wait", ms: 600 }
    ]);
  });

  it("can skip upward recovery steps", () => {
    const actions = buildScrollCycleActions({
      capturePauseMs: 5000,
      scrollStepMinPx: 300,
      scrollStepMaxPx: 300,
      scrollStepPauseMinMs: 600,
      scrollStepPauseMaxMs: 600,
      wheelTickMinPx: 100,
      wheelTickMaxPx: 100,
      wheelTickPauseMinMs: 20,
      wheelTickPauseMaxMs: 20,
      wheelReverseTickChance: 0,
      upwardScrollChance: 0,
      random: createRandom([0, 0, 0])
    });

    expect(actions).toEqual([
      { kind: "wheel", deltaY: 100 },
      { kind: "wait", ms: 20 },
      { kind: "wheel", deltaY: 100 },
      { kind: "wait", ms: 20 },
      { kind: "wheel", deltaY: 100 },
      { kind: "wait", ms: 20 },
      { kind: "wait", ms: 600 }
    ]);
  });
});
