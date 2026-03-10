export interface ScrollHumanizerDriver {
  refresh(): Promise<void>;
  wait(ms: number): Promise<void>;
  wheelTick(input: { deltaY: number }): Promise<void>;
}

export interface ScrollHumanizerAction {
  kind: "wait" | "wheel";
  ms?: number;
  deltaY?: number;
}

export interface ScrollCycleBounds {
  minPx?: number;
  maxPx?: number;
}

export interface ScrollHumanizerOptions {
  capturePauseMs: number;
  capturePauseJitterRatio?: number;
  refreshSettlingMsMin?: number;
  refreshSettlingMsMax?: number;
  scrollStepsMin?: number;
  scrollStepsMax?: number;
  scrollStepMinPx?: number;
  scrollStepMaxPx?: number;
  scrollStepPauseMinMs?: number;
  scrollStepPauseMaxMs?: number;
  wheelTickMinPx?: number;
  wheelTickMaxPx?: number;
  wheelTickPauseMinMs?: number;
  wheelTickPauseMaxMs?: number;
  wheelReverseTickChance?: number;
  wheelReverseTickRatioMin?: number;
  wheelReverseTickRatioMax?: number;
  upwardScrollChance?: number;
  upwardScrollRatioMin?: number;
  upwardScrollRatioMax?: number;
  random?: () => number;
}

const defaultOptions = {
  capturePauseJitterRatio: 0.35,
  refreshSettlingMsMin: 1800,
  refreshSettlingMsMax: 4200,
  scrollStepsMin: 3,
  scrollStepsMax: 6,
  scrollStepMinPx: 260,
  scrollStepMaxPx: 720,
  scrollStepPauseMinMs: 500,
  scrollStepPauseMaxMs: 1400,
  wheelTickMinPx: 24,
  wheelTickMaxPx: 140,
  wheelTickPauseMinMs: 12,
  wheelTickPauseMaxMs: 70,
  wheelReverseTickChance: 0.14,
  wheelReverseTickRatioMin: 0.12,
  wheelReverseTickRatioMax: 0.38,
  upwardScrollChance: 0.18,
  upwardScrollRatioMin: 0.18,
  upwardScrollRatioMax: 0.6
} satisfies Omit<Required<ScrollHumanizerOptions>, "capturePauseMs" | "random">;

function clampProbability(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function randomInt(min: number, max: number, random: () => number): number {
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  return Math.floor(random() * (safeMax - safeMin + 1)) + safeMin;
}

function randomRatio(min: number, max: number, random: () => number): number {
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  return safeMin + (safeMax - safeMin) * random();
}

function resolveOptions(options: ScrollHumanizerOptions) {
  const random = options.random ?? Math.random;

  return {
    ...defaultOptions,
    ...options,
    wheelReverseTickChance: clampProbability(
      options.wheelReverseTickChance ?? defaultOptions.wheelReverseTickChance
    ),
    upwardScrollChance: clampProbability(options.upwardScrollChance ?? defaultOptions.upwardScrollChance),
    random
  };
}

export function buildCapturePauseAction(options: ScrollHumanizerOptions): ScrollHumanizerAction {
  const resolved = resolveOptions(options);
  const jitter = Math.max(250, Math.round(resolved.capturePauseMs * resolved.capturePauseJitterRatio));
  const ms = randomInt(
    Math.max(250, resolved.capturePauseMs - jitter),
    resolved.capturePauseMs + jitter,
    resolved.random
  );
  return { kind: "wait", ms };
}

export function buildRefreshStartActions(options: ScrollHumanizerOptions): ScrollHumanizerAction[] {
  const resolved = resolveOptions(options);
  return [
    {
      kind: "wait",
      ms: randomInt(resolved.refreshSettlingMsMin, resolved.refreshSettlingMsMax, resolved.random)
    }
  ];
}

export function buildScrollCycleActions(
  options: ScrollHumanizerOptions,
  bounds?: ScrollCycleBounds
): ScrollHumanizerAction[] {
  const resolved = resolveOptions(options);
  const actions: ScrollHumanizerAction[] = [];
  const minPx = Math.max(40, Math.round(bounds?.minPx ?? resolved.scrollStepMinPx));
  const maxPx = Math.max(minPx, Math.round(bounds?.maxPx ?? resolved.scrollStepMaxPx));
  const downDistance = randomInt(minPx, maxPx, resolved.random);
  pushWheelBurst(actions, downDistance, resolved);

  if (resolved.random() < resolved.upwardScrollChance) {
    const upwardRatio = randomRatio(
      resolved.upwardScrollRatioMin,
      resolved.upwardScrollRatioMax,
      resolved.random
    );
    const upwardDistance = Math.max(40, Math.round(downDistance * upwardRatio));
    pushWheelBurst(actions, -upwardDistance, resolved);
  }

  return actions;
}

function pushWheelBurst(
  actions: ScrollHumanizerAction[],
  totalDeltaY: number,
  options: ReturnType<typeof resolveOptions>
): void {
  const direction = totalDeltaY < 0 ? -1 : 1;
  let remaining = Math.abs(totalDeltaY);

  while (remaining > 0) {
    const tickMagnitude = Math.min(
      remaining,
      randomInt(options.wheelTickMinPx, options.wheelTickMaxPx, options.random)
    );

    actions.push({
      kind: "wheel",
      deltaY: direction * tickMagnitude
    });

    remaining -= tickMagnitude;

    actions.push({
      kind: "wait",
      ms: randomInt(options.wheelTickPauseMinMs, options.wheelTickPauseMaxMs, options.random)
    });

    if (remaining > 0 && options.random() < options.wheelReverseTickChance) {
      const reverseMagnitude = Math.max(
        4,
        Math.round(
          tickMagnitude *
            randomRatio(options.wheelReverseTickRatioMin, options.wheelReverseTickRatioMax, options.random)
        )
      );
      actions.push({
        kind: "wheel",
        deltaY: -direction * reverseMagnitude
      });
      actions.push({
        kind: "wait",
        ms: randomInt(options.wheelTickPauseMinMs, options.wheelTickPauseMaxMs, options.random)
      });
    }
  }

  actions.push({
    kind: "wait",
    ms: randomInt(options.scrollStepPauseMinMs, options.scrollStepPauseMaxMs, options.random)
  });
}

export function createScrollHumanizer(options: ScrollHumanizerOptions) {
  return {
    async refreshAtStart(driver: ScrollHumanizerDriver): Promise<void> {
      await driver.refresh();

      for (const action of buildRefreshStartActions(options)) {
        if (action.kind === "wait" && action.ms) {
          await driver.wait(action.ms);
        }
      }
    },

    async pauseBeforeCapture(driver: ScrollHumanizerDriver): Promise<void> {
      const action = buildCapturePauseAction(options);
      if (action.kind === "wait" && action.ms) {
        await driver.wait(action.ms);
      }
    },

    async scroll(driver: ScrollHumanizerDriver, bounds?: ScrollCycleBounds): Promise<void> {
      const actions = buildScrollCycleActions(options, bounds);

      for (const action of actions) {
        if (action.kind === "wait" && action.ms) {
          await driver.wait(action.ms);
          continue;
        }

        if (action.kind === "wheel" && action.deltaY !== undefined) {
          await driver.wheelTick({ deltaY: action.deltaY });
        }
      }
    }
  };
}
