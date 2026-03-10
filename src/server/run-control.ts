import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { ensureDir, writeJson } from "@/src/lib/fs";
import type { RunHistoryEntry, RunTask, SchedulerConfig } from "@/src/lib/types";

const projectRoot = process.cwd();
const controlDir = path.join(projectRoot, "data", "control");
const logsDir = path.join(controlDir, "logs");
const schedulerConfigPath = path.join(controlDir, "scheduler.json");
const runHistoryPath = path.join(controlDir, "run-history.json");

const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  enabled: false,
  frequency: "daily",
  hour: 9,
  minute: 0,
  times: ["09:00"],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles",
  updatedAt: new Date().toISOString(),
  lastEvaluatedAt: null,
  lastTriggeredAt: null
};

const TASK_TO_COMMAND: Record<RunTask, { command: string; args: string[] }> = {
  crawl_timeline: { command: "npm", args: ["run", "crawl:timeline"] },
  crawl_openclaw: { command: "npm", args: ["run", "crawl:openclaw"] },
  capture_openclaw_current: { command: "npm", args: ["run", "capture:openclaw-current"] },
  analyze_missing: { command: "npm", args: ["run", "analyze:missing"] },
  rebuild_media_assets: { command: "npm", args: ["run", "media:rebuild"] }
};

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function writeJsonFile<T>(filePath: string, data: T): void {
  ensureDir(path.dirname(filePath));
  writeJson(filePath, data);
}

function isoNow(): string {
  return new Date().toISOString();
}

function toDateParts(date: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute")
  };
}

function sameLocalDay(a: Date, b: Date, timezone: string): boolean {
  const aParts = toDateParts(a, timezone);
  const bParts = toDateParts(b, timezone);

  return (
    aParts.year === bParts.year &&
    aParts.month === bParts.month &&
    aParts.day === bParts.day
  );
}

function sameLocalMinute(a: Date, b: Date, timezone: string): boolean {
  const aParts = toDateParts(a, timezone);
  const bParts = toDateParts(b, timezone);

  return (
    aParts.year === bParts.year &&
    aParts.month === bParts.month &&
    aParts.day === bParts.day &&
    aParts.hour === bParts.hour &&
    aParts.minute === bParts.minute
  );
}

function normalizeScheduleTime(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeScheduleTimes(values: string[] | undefined, fallbackHour: number, fallbackMinute: number): string[] {
  const fromValues = (values ?? [])
    .map((value) => normalizeScheduleTime(value))
    .filter((value): value is string => value !== null);

  const unique = Array.from(
    new Set(
      (fromValues.length > 0
        ? fromValues
        : [`${String(fallbackHour).padStart(2, "0")}:${String(fallbackMinute).padStart(2, "0")}`]
      ).sort()
    )
  );

  return unique.length > 0 ? unique : DEFAULT_SCHEDULER_CONFIG.times;
}

function normalizeSchedulerConfig(config: SchedulerConfig): SchedulerConfig {
  const times = normalizeScheduleTimes(config.times, config.hour, config.minute);
  const [firstHour, firstMinute] = times[0].split(":").map(Number);

  return {
    ...config,
    hour: firstHour,
    minute: firstMinute,
    times
  };
}

export function readSchedulerConfig(): SchedulerConfig {
  const config = readJsonFile<SchedulerConfig>(schedulerConfigPath, DEFAULT_SCHEDULER_CONFIG);
  return normalizeSchedulerConfig(config);
}

export function writeSchedulerConfig(
  partial: Partial<Pick<SchedulerConfig, "enabled" | "hour" | "minute" | "timezone" | "times">>
): SchedulerConfig {
  const current = readSchedulerConfig();
  const fallbackHour = partial.hour ?? current.hour ?? DEFAULT_SCHEDULER_CONFIG.hour;
  const fallbackMinute = partial.minute ?? current.minute ?? DEFAULT_SCHEDULER_CONFIG.minute;
  const times = normalizeScheduleTimes(partial.times ?? current.times, fallbackHour, fallbackMinute);
  const [hour, minute] = times[0].split(":").map(Number);
  const next: SchedulerConfig = {
    ...current,
    ...partial,
    frequency: "daily",
    hour,
    minute,
    times,
    timezone: partial.timezone ?? current.timezone ?? DEFAULT_SCHEDULER_CONFIG.timezone,
    updatedAt: isoNow()
  };

  writeJsonFile(schedulerConfigPath, next);
  return next;
}

export function readRunHistory(): RunHistoryEntry[] {
  return readJsonFile<RunHistoryEntry[]>(runHistoryPath, []).sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt)
  );
}

function writeRunHistory(entries: RunHistoryEntry[]): void {
  writeJsonFile(runHistoryPath, entries);
}

function updateRunHistoryEntry(runControlId: string, updater: (entry: RunHistoryEntry) => RunHistoryEntry) {
  const entries = readRunHistory();
  const nextEntries = entries.map((entry) =>
    entry.runControlId === runControlId ? updater(entry) : entry
  );
  writeRunHistory(nextEntries);
}

function appendLog(logPath: string, message: string): void {
  ensureDir(path.dirname(logPath));
  fs.appendFileSync(logPath, message);
}

function discoverLatestManifestRunId(): string | null {
  const rawDir = path.join(projectRoot, "data", "raw");
  if (!fs.existsSync(rawDir)) {
    return null;
  }

  const runIds = fs
    .readdirSync(rawDir)
    .filter((entry) => fs.existsSync(path.join(rawDir, entry, "manifest.json")))
    .sort();

  return runIds.at(-1) ?? null;
}

export function triggerTask(
  task: RunTask,
  trigger: "manual" | "scheduled",
  options?: { openclawTargetTabIndex?: number | null }
): RunHistoryEntry {
  ensureDir(logsDir);

  const startedAt = isoNow();
  const runControlId = `${task}-${startedAt.replace(/[:.]/g, "-")}`;
  const logPath = path.join(logsDir, `${runControlId}.log`);
  const historyEntry: RunHistoryEntry = {
    runControlId,
    task,
    trigger,
    status: "running",
    startedAt,
    completedAt: null,
    exitCode: null,
    errorMessage: null,
    logPath: path.relative(projectRoot, logPath),
    manifestRunId: null
  };

  const entries = readRunHistory();
  writeRunHistory([historyEntry, ...entries]);
  appendLog(logPath, `[${startedAt}] started ${task} (${trigger})\n`);
  if (typeof options?.openclawTargetTabIndex === "number") {
    appendLog(logPath, `[${startedAt}] OPENCLAW_TARGET_TAB_INDEX=${options.openclawTargetTabIndex}\n`);
  }

  const { command, args } = TASK_TO_COMMAND[task];
  const child = spawn(command, args, {
    cwd: projectRoot,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...(typeof options?.openclawTargetTabIndex === "number"
        ? { OPENCLAW_TARGET_TAB_INDEX: String(options.openclawTargetTabIndex) }
        : {})
    }
  });

  child.stdout?.on("data", (chunk: Buffer | string) => {
    appendLog(logPath, chunk.toString());
  });

  child.stderr?.on("data", (chunk: Buffer | string) => {
    appendLog(logPath, chunk.toString());
  });

  child.on("error", (error) => {
    updateRunHistoryEntry(runControlId, (entry) => ({
      ...entry,
      status: "failed",
      completedAt: isoNow(),
      errorMessage: error.message
    }));
    appendLog(logPath, `\n[${isoNow()}] spawn error: ${error.message}\n`);
  });

  child.on("close", (code) => {
    const manifestRunId =
      task === "crawl_timeline" || task === "crawl_openclaw" || task === "capture_openclaw_current"
        ? discoverLatestManifestRunId()
        : null;
    updateRunHistoryEntry(runControlId, (entry) => ({
      ...entry,
      status: code === 0 ? "completed" : "failed",
      completedAt: isoNow(),
      exitCode: code,
      errorMessage: code === 0 ? null : `Process exited with code ${code}`,
      manifestRunId
    }));
    appendLog(logPath, `\n[${isoNow()}] completed with code ${code}\n`);
  });

  child.unref();
  return historyEntry;
}

export function evaluateSchedule(now = new Date()): {
  triggered: boolean;
  config: SchedulerConfig;
  entry: RunHistoryEntry | null;
} {
  const config = readSchedulerConfig();
  const nextConfig: SchedulerConfig = {
    ...config,
    lastEvaluatedAt: isoNow()
  };

  if (!config.enabled) {
    writeJsonFile(schedulerConfigPath, nextConfig);
    return { triggered: false, config: nextConfig, entry: null };
  }

  const nowParts = toDateParts(now, config.timezone);
  const lastTriggeredAt = config.lastTriggeredAt ? new Date(config.lastTriggeredAt) : null;
  const hasTriggeredThisMinute =
    lastTriggeredAt !== null && sameLocalMinute(lastTriggeredAt, now, config.timezone);
  const currentTime = `${String(nowParts.hour).padStart(2, "0")}:${String(nowParts.minute).padStart(2, "0")}`;
  const shouldRunNow = config.times.includes(currentTime) && !hasTriggeredThisMinute;

  if (!shouldRunNow) {
    writeJsonFile(schedulerConfigPath, nextConfig);
    return { triggered: false, config: nextConfig, entry: null };
  }

  const entry = triggerTask("crawl_openclaw", "scheduled");
  const updatedConfig: SchedulerConfig = {
    ...nextConfig,
    lastTriggeredAt: isoNow()
  };
  writeJsonFile(schedulerConfigPath, updatedConfig);
  return { triggered: true, config: updatedConfig, entry };
}

export function getRunLog(logRelativePath: string): string {
  const absolutePath = path.join(projectRoot, logRelativePath);
  if (!fs.existsSync(absolutePath)) {
    return "";
  }

  return fs.readFileSync(absolutePath, "utf8");
}
