import { NextResponse } from "next/server";
import { readSchedulerConfig, writeSchedulerConfig } from "@/src/server/run-control";

export async function GET() {
  return NextResponse.json(readSchedulerConfig());
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<{
    enabled: boolean;
    hour: number;
    minute: number;
    times: string[];
    timezone: string;
  }>;

  const config = writeSchedulerConfig({
    enabled: body.enabled,
    hour: body.hour,
    minute: body.minute,
    times: body.times,
    timezone: body.timezone
  });

  return NextResponse.json(config);
}
