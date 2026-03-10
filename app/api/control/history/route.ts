import { NextResponse } from "next/server";
import { readRunHistory } from "@/src/server/run-control";

export async function GET() {
  return NextResponse.json(readRunHistory());
}
