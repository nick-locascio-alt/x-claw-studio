import { NextResponse } from "next/server";
import { analyzeAndIndexTweetUsage } from "@/src/server/analysis-pipeline";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { tweetId?: string; mediaIndex?: number };
    if (!body.tweetId) {
      return NextResponse.json({ error: "tweetId is required" }, { status: 400 });
    }

    const result = await analyzeAndIndexTweetUsage(body.tweetId, body.mediaIndex ?? 0);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown analysis error" },
      { status: 500 }
    );
  }
}
