export interface ScrollHumanizerDriver {
  refresh(): Promise<void>;
  wait(ms: number): Promise<void>;
  wheelTick(input: { deltaY: number }): Promise<void>;
  wheelBurst?(steps: ScrollHumanizerWheelStep[]): Promise<void>;
}

export interface ScrollHumanizerAction {
  kind: "wait" | "wheel";
  ms?: number;
  deltaY?: number;
}

export interface ScrollHumanizerWheelStep {
  deltaY: number;
  delayMs: number;
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
  wheelNotchMinPx?: number;
  wheelNotchMaxPx?: number;
  wheelMicroStepsMin?: number;
  wheelMicroStepsMax?: number;
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
  wheelTickMinPx: 2,
  wheelTickMaxPx: 14,
  wheelTickPauseMinMs: 2,
  wheelTickPauseMaxMs: 8,
  wheelNotchMinPx: 96,
  wheelNotchMaxPx: 144,
  wheelMicroStepsMin: 8,
  wheelMicroStepsMax: 16,
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

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
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
    const notchMagnitude = Math.min(
      remaining,
      randomInt(options.wheelNotchMinPx, options.wheelNotchMaxPx, options.random)
    );
    const microStepCount = randomInt(options.wheelMicroStepsMin, options.wheelMicroStepsMax, options.random);
    const weights = Array.from({ length: microStepCount }, (_, index) => {
      const position = microStepCount === 1 ? 0.5 : index / (microStepCount - 1);
      const eased = Math.sin(position * Math.PI);
      return 0.6 + eased;
    });
    const totalWeight = sum(weights);
    let consumed = 0;

    for (let stepIndex = 0; stepIndex < microStepCount; stepIndex += 1) {
      const remainingSteps = microStepCount - stepIndex;
      const weightedTarget =
        stepIndex === microStepCount - 1
          ? notchMagnitude - consumed
          : Math.round((notchMagnitude * weights[stepIndex]) / totalWeight);
      const stepMagnitude = Math.min(
        notchMagnitude - consumed - Math.max(0, remainingSteps - 1),
        Math.max(
          1,
          Math.min(
            weightedTarget,
            randomInt(options.wheelTickMinPx, options.wheelTickMaxPx, options.random)
          )
        )
      );

      consumed += stepMagnitude;
      actions.push({
        kind: "wheel",
        deltaY: direction * stepMagnitude
      });
      actions.push({
        kind: "wait",
        ms: randomInt(options.wheelTickPauseMinMs, options.wheelTickPauseMaxMs, options.random)
      });
    }

    remaining -= notchMagnitude;

    if (remaining > 0 && options.random() < options.wheelReverseTickChance) {
      const reverseMagnitude = Math.max(
        2,
        Math.round(
          notchMagnitude *
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

    actions.push({
      kind: "wait",
      ms: randomInt(10, 28, options.random)
    });
  }

  actions.push({
    kind: "wait",
    ms: randomInt(options.scrollStepPauseMinMs, options.scrollStepPauseMaxMs, options.random)
  });
}

export function collapseWheelBurstActions(actions: ScrollHumanizerAction[]): ScrollHumanizerWheelStep[] {
  const steps: ScrollHumanizerWheelStep[] = [];

  for (const action of actions) {
    if (action.kind === "wheel" && action.deltaY !== undefined) {
      steps.push({
        deltaY: action.deltaY,
        delayMs: 0
      });
      continue;
    }

    if (action.kind === "wait" && action.ms && steps.length > 0) {
      steps[steps.length - 1].delayMs += action.ms;
    }
  }

  return steps;
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

      if (driver.wheelBurst) {
        await driver.wheelBurst(collapseWheelBurstActions(actions));
        return;
      }

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
