import { NextResponse } from "next/server";
import { verifyOpenClawTabHealth } from "@/src/server/openclaw-browser";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawTabIndex = url.searchParams.get("tabIndex");
  const tabIndex =
    rawTabIndex !== null && Number.isInteger(Number(rawTabIndex)) && Number(rawTabIndex) >= 0
      ? Number(rawTabIndex)
      : 0;

  const result = await verifyOpenClawTabHealth(tabIndex);
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
