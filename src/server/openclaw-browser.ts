import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadEnv } from "@/src/lib/env";

const execFileAsync = promisify(execFile);

loadEnv();

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
    env: process.env
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
      env: process.env
    }
  );

  return parseEvaluateOutput(stdout);
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
    env: process.env
  });

  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function openclawNavigate(targetId: string, url: string): Promise<void> {
  await execFileAsync(
    "openclaw",
    [
      "browser",
      "--browser-profile",
      "chrome",
      "--timeout",
      "120000",
      "navigate",
      "--target-id",
      targetId,
      url
    ],
    {
      cwd: process.cwd(),
      env: process.env
    }
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
      env: process.env
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

  const url = selected.url ?? "";
  if (!url.includes("x.com") && !url.includes("twitter.com")) {
    throw new Error(
      [
        `Attached tab index ${tabIndex} is not an X/Twitter page.`,
        `url=${url || "unknown"}`,
        "Use `openclaw browser --browser-profile chrome tabs --json` and choose a tab whose URL is on x.com or twitter.com."
      ].join(" ")
    );
  }

  return selected;
}
