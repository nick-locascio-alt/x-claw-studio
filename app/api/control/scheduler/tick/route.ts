import { NextResponse } from "next/server";
import { evaluateSchedule } from "@/src/server/run-control";

export async function POST() {
  return NextResponse.json(evaluateSchedule());
}
