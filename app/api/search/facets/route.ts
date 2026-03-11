import { NextResponse } from "next/server";
import { searchFacetIndex } from "@/src/server/chroma-facets";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const facetName = searchParams.get("facetName") || undefined;
    const limit = Number(searchParams.get("limit") || 20);

    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const result = await searchFacetIndex({
      query,
      facetName: facetName as never,
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
