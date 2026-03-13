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
    topicBatchLimit?: number | null;
  };
  const task = body.task;
  const openclawTargetTabIndex =
    typeof body.openclawTargetTabIndex === "number" && Number.isInteger(body.openclawTargetTabIndex) && body.openclawTargetTabIndex >= 0
      ? body.openclawTargetTabIndex
      : null;
  const openclawKeepScrollPosition = body.openclawKeepScrollPosition === true;
  const openclawStartUrl = body.openclawStartUrl ? normalizeXStatusUrl(body.openclawStartUrl) : null;
  const topicBatchLimit =
    typeof body.topicBatchLimit === "number" && Number.isInteger(body.topicBatchLimit) && body.topicBatchLimit > 0
      ? body.topicBatchLimit
      : null;

  if (
    task !== "crawl_timeline" &&
    task !== "crawl_openclaw" &&
    task !== "capture_openclaw_current" &&
    task !== "capture_openclaw_current_tweet" &&
    task !== "capture_openclaw_current_tweet_and_compose_replies" &&
    task !== "analyze_missing" &&
    task !== "analyze_topics" &&
    task !== "rebuild_media_assets" &&
    task !== "backfill_media_native_types"
  ) {
    return NextResponse.json({ error: "Invalid task" }, { status: 400 });
  }

  if (body.openclawStartUrl && !openclawStartUrl) {
    return NextResponse.json({ error: "OpenClaw start URL must be a single tweet status URL on x.com or twitter.com" }, { status: 400 });
  }

  if (
    (
      task === "crawl_openclaw" ||
      task === "capture_openclaw_current" ||
      task === "capture_openclaw_current_tweet" ||
      task === "capture_openclaw_current_tweet_and_compose_replies"
    ) &&
    openclawTargetTabIndex !== null
  ) {
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

  const entry = triggerTask(task, "manual", {
    openclawTargetTabIndex,
    openclawKeepScrollPosition,
    openclawStartUrl,
    topicBatchLimit
  });
  return NextResponse.json(entry);
}
