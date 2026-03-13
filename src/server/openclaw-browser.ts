import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadEnv } from "@/src/lib/env";

const execFileAsync = promisify(execFile);
loadEnv();
const OPENCLAW_EXEC_MAX_BUFFER_BYTES = Math.max(
  1024 * 1024,
  Number(process.env.OPENCLAW_EXEC_MAX_BUFFER_MB || 16) * 1024 * 1024
);

export interface OpenClawTab {
  targetId: string;
  id?: number;
  title?: string;
  url?: string;
  attached?: boolean;
}

export function resolveOpenClawTabIndex(argv: string[] = process.argv.slice(2)): number {
  const rawValue = argv[0] ?? process.env.OPENCLAW_TARGET_TAB_INDEX ?? "0";
  const index = Number(rawValue);

  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Invalid OpenClaw tab index: ${rawValue}`);
  }

  return index;
}

function parseJson<T>(stdout: string): T {
  return JSON.parse(stdout) as T;
}

async function runBrowserJson<T>(args: string[]): Promise<T> {
  const { stdout } = await execFileAsync("openclaw", args, {
    cwd: process.cwd(),
    env: process.env,
    maxBuffer: OPENCLAW_EXEC_MAX_BUFFER_BYTES
  });
  return parseJson<T>(stdout);
}

export async function listChromeTabs(): Promise<OpenClawTab[]> {
  const result = await runBrowserJson<{ tabs: OpenClawTab[] }>([
    "browser",
    "--browser-profile",
    "chrome",
    "tabs",
    "--json"
  ]);
  return result.tabs ?? [];
}

export async function browserStatus() {
  return runBrowserJson<{
    enabled: boolean;
    running: boolean;
    cdpReady: boolean;
    cdpHttp: boolean;
    cdpUrl: string;
    profile: string;
  }>(["browser", "--browser-profile", "chrome", "status", "--json"]);
}

function parseEvaluateOutput(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return null;
  }

  const lines = trimmed.split("\n");
  const jsonStartIndex = lines.findIndex((line) => {
    const value = line.trim();
    return (
      value.startsWith("{") ||
      value.startsWith("[") ||
      value.startsWith('"') ||
      value === "true" ||
      value === "false" ||
      value === "null" ||
      /^-?\d/.test(value)
    );
  });

  if (jsonStartIndex === -1) {
    throw new Error(`Unexpected OpenClaw evaluate output: ${trimmed}`);
  }

  return JSON.parse(lines.slice(jsonStartIndex).join("\n")) as unknown;
}

export async function evaluateOnTab(targetId: string, fn: string): Promise<unknown> {
  const { stdout } = await execFileAsync(
    "openclaw",
    [
      "browser",
      "--browser-profile",
      "chrome",
      "evaluate",
      "--target-id",
      targetId,
      "--fn",
      fn
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: OPENCLAW_EXEC_MAX_BUFFER_BYTES
    }
  );

  return parseEvaluateOutput(stdout);
}

function isXTab(tab: OpenClawTab): boolean {
  const url = tab.url ?? "";
  return url.includes("x.com") || url.includes("twitter.com");
}

function isTabNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("tab not found");
}

async function canEvaluateTab(targetId: string): Promise<boolean> {
  try {
    await evaluateOnTab(
      targetId,
      `() => ({
        href: window.location.href || null,
        title: document.title || null
      })`
    );
    return true;
  } catch (error) {
    if (isTabNotFoundError(error)) {
      return false;
    }
    throw error;
  }
}

export async function readRequests(targetId: string, filter?: string): Promise<string[]> {
  const args = [
    "browser",
    "--browser-profile",
    "chrome",
    "--timeout",
    "120000",
    "requests",
    "--target-id",
    targetId
  ];

  if (filter) {
    args.push("--filter", filter);
  }

  const { stdout } = await execFileAsync("openclaw", args, {
    cwd: process.cwd(),
    env: process.env,
    maxBuffer: OPENCLAW_EXEC_MAX_BUFFER_BYTES
  });

  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function openclawNavigate(targetId: string, url: string): Promise<void> {
  await evaluateOnTab(
    targetId,
    `() => {
      window.location.assign(${JSON.stringify(url)});
      return true;
    }`
  );
}

export async function openclawWait(targetId: string, ms: number): Promise<void> {
  await execFileAsync(
    "openclaw",
    [
      "browser",
      "--browser-profile",
      "chrome",
      "wait",
      "--target-id",
      targetId,
      "--time",
      String(ms),
      "--timeout-ms",
      String(Math.max(ms + 5000, 20000))
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: OPENCLAW_EXEC_MAX_BUFFER_BYTES
    }
  );
}

export async function openclawRefresh(targetId: string): Promise<void> {
  await evaluateOnTab(
    targetId,
    `() => {
      window.location.reload();
      return true;
    }`
  );
}

export async function openclawFocus(targetId: string): Promise<void> {
  await execFileAsync(
    "openclaw",
    [
      "browser",
      "--browser-profile",
      "chrome",
      "focus",
      targetId
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: OPENCLAW_EXEC_MAX_BUFFER_BYTES
    }
  );
}


export async function chooseAttachedXTab(tabIndex = 0): Promise<OpenClawTab> {
  const tabs = await listChromeTabs();
  const selected = tabs[tabIndex];

  if (!selected) {
    const status = await browserStatus();
    throw new Error(
      [
        "No attached Chrome tab found for the requested OpenClaw tab index.",
        `requested tab index=${tabIndex} availableTabs=${tabs.length}`,
        `chrome profile status: running=${status.running} cdpReady=${status.cdpReady} cdpUrl=${status.cdpUrl}`,
        "Use `openclaw browser --browser-profile chrome tabs --json` to inspect the available attached tabs."
      ].join(" ")
    );
  }

  if (!isXTab(selected)) {
    throw new Error(
      [
        `Attached tab index ${tabIndex} is not an X/Twitter page.`,
        `url=${selected.url || "unknown"}`,
        "Use `openclaw browser --browser-profile chrome tabs --json` and choose a tab whose URL is on x.com or twitter.com."
      ].join(" ")
    );
  }

  if (await canEvaluateTab(selected.targetId)) {
    return selected;
  }

  for (const candidate of tabs) {
    if (candidate.targetId === selected.targetId || !isXTab(candidate)) {
      continue;
    }

    if (await canEvaluateTab(candidate.targetId)) {
      console.warn(
        [
          "Requested OpenClaw tab is listed but not controllable; falling back to another healthy X tab.",
          `requestedIndex=${tabIndex}`,
          `requestedTargetId=${selected.targetId}`,
          `fallbackTargetId=${candidate.targetId}`,
          `fallbackUrl=${candidate.url || "unknown"}`
        ].join(" ")
      );
      return candidate;
    }
  }

  throw new Error(
    [
      "OpenClaw found X/Twitter tabs, but none were controllable.",
      `requested tab index=${tabIndex}`,
      `requested targetId=${selected.targetId}`,
      "Use `openclaw browser --browser-profile chrome tabs --json` to inspect tabs, then reload or reopen the broken X tab before rerunning the crawl."
    ].join(" ")
  );
}

export async function verifyOpenClawTabHealth(tabIndex = 0): Promise<{
  ok: boolean;
  tab: OpenClawTab | null;
  error: string | null;
}> {
  try {
    const tab = await chooseAttachedXTab(tabIndex);
    await evaluateOnTab(
      tab.targetId,
      `() => ({
        href: window.location.href || null,
        title: document.title || null
      })`
    );

    return {
      ok: true,
      tab,
      error: null
    };
  } catch (error) {
    return {
      ok: false,
      tab: null,
      error: error instanceof Error ? error.message : "OpenClaw tab health check failed"
    };
  }
}
