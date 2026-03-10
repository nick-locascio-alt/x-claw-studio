import { NextResponse } from "next/server";
import { listChromeTabs } from "@/src/server/openclaw-browser";

export async function GET() {
  try {
    const tabs = await listChromeTabs();
    return NextResponse.json({ tabs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load OpenClaw tabs" },
      { status: 500 }
    );
  }
}
