import { NextResponse } from "next/server";
import { searchTopicIndex } from "@/src/server/chroma-facets";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const limit = Number(searchParams.get("limit") || 12);

    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const result = await searchTopicIndex({
      query,
      limit
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown search error" },
      { status: 500 }
    );
  }
}
