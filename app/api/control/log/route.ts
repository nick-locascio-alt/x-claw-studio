import { NextResponse } from "next/server";
import { getRunLog } from "@/src/server/run-control";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  return NextResponse.json({ path, content: getRunLog(path) });
}
