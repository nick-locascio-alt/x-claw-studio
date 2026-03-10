import { NextResponse } from "next/server";
import { setMediaAssetStarred } from "@/src/server/media-assets";

export async function POST(request: Request) {
  const body = (await request.json()) as { assetId?: string; starred?: boolean };

  if (!body.assetId || typeof body.starred !== "boolean") {
    return NextResponse.json({ error: "Invalid asset star request" }, { status: 400 });
  }

  const updated = setMediaAssetStarred(body.assetId, body.starred);
  if (!updated) {
    return NextResponse.json({ error: "Unknown asset" }, { status: 404 });
  }

  return NextResponse.json({ assetId: body.assetId, starred: body.starred });
}
