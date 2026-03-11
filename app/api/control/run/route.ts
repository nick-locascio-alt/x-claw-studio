import { NextResponse } from "next/server";
import { normalizeXStatusUrl } from "@/src/lib/x-status-url";
import { verifyOpenClawTabHealth } from "@/src/server/openclaw-browser";
import { triggerTask } from "@/src/server/run-control";
import type { RunTask } from "@/src/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    task?: RunTask;
    openclawTargetTabIndex?: number | null;
    openclawKeepScrollPosition?: boolean;
    openclawStartUrl?: string | null;
  };
  const task = body.task;
  const openclawTargetTabIndex =
    typeof body.openclawTargetTabIndex === "number" && Number.isInteger(body.openclawTargetTabIndex) && body.openclawTargetTabIndex >= 0
      ? body.openclawTargetTabIndex
      : null;
  const openclawKeepScrollPosition = body.openclawKeepScrollPosition === true;
  const openclawStartUrl = body.openclawStartUrl ? normalizeXStatusUrl(body.openclawStartUrl) : null;

  if (
    task !== "crawl_timeline" &&
    task !== "crawl_openclaw" &&
    task !== "capture_openclaw_current" &&
    task !== "analyze_missing" &&
    task !== "rebuild_media_assets" &&
    task !== "backfill_media_native_types"
  ) {
    return NextResponse.json({ error: "Invalid task" }, { status: 400 });
  }

  if (body.openclawStartUrl && !openclawStartUrl) {
    return NextResponse.json({ error: "OpenClaw start URL must be a single tweet status URL on x.com or twitter.com" }, { status: 400 });
  }

  if ((task === "crawl_openclaw" || task === "capture_openclaw_current") && openclawTargetTabIndex !== null) {
    const health = await verifyOpenClawTabHealth(openclawTargetTabIndex);
    if (!health.ok) {
      return NextResponse.json(
        {
          error: `OpenClaw preflight failed for tab ${openclawTargetTabIndex}: ${health.error}. Restart Chrome/OpenClaw attachment and try again.`
        },
        { status: 503 }
      );
    }
  }

  const entry = triggerTask(task, "manual", { openclawTargetTabIndex, openclawKeepScrollPosition, openclawStartUrl });
  return NextResponse.json(entry);
}
