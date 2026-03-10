import { NextResponse } from "next/server";
import { triggerTask } from "@/src/server/run-control";
import type { RunTask } from "@/src/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as { task?: RunTask; openclawTargetTabIndex?: number | null };
  const task = body.task;
  const openclawTargetTabIndex =
    typeof body.openclawTargetTabIndex === "number" && Number.isInteger(body.openclawTargetTabIndex) && body.openclawTargetTabIndex >= 0
      ? body.openclawTargetTabIndex
      : null;

  if (
    task !== "crawl_timeline" &&
    task !== "crawl_openclaw" &&
    task !== "capture_openclaw_current" &&
    task !== "analyze_missing" &&
    task !== "rebuild_media_assets"
  ) {
    return NextResponse.json({ error: "Invalid task" }, { status: 400 });
  }

  const entry = triggerTask(task, "manual", { openclawTargetTabIndex });
  return NextResponse.json(entry);
}
