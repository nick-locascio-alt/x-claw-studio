import { NextResponse } from "next/server";
import { mediaPostRequestSchema, type MediaPostProgressEvent } from "@/src/lib/media-post-composer";
import { createGeneratedDraft, markGeneratedDraftComplete, updateGeneratedDraft } from "@/src/server/generated-drafts";
import { composeTweetFromMediaAsset } from "@/src/server/media-post-composer";

export async function POST(request: Request) {
  try {
    const body = mediaPostRequestSchema.parse(await request.json());
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        function write(event: unknown): void {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }

        const draftRecord = createGeneratedDraft({
          kind: "media_post",
          usageId: body.usageId,
          requestMode: "single",
          progressStage: "starting",
          progressMessage: "Starting media composition"
        });

        try {
          const result = await composeTweetFromMediaAsset(body, {
            onProgress(event: MediaPostProgressEvent) {
              updateGeneratedDraft(draftRecord.draftId, {
                progressStage: event.stage,
                progressMessage: event.message,
                progressDetail: event.detail ?? null
              });
              write({ type: "progress", ...event });
            }
          });

          markGeneratedDraftComplete({
            draftId: draftRecord.draftId,
            kind: "media_post",
            result
          });
          write({ type: "result", result });
          controller.close();
        } catch (error) {
          updateGeneratedDraft(draftRecord.draftId, {
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Unknown media composition error"
          });
          write({
            type: "error",
            error: error instanceof Error ? error.message : "Unknown media composition error"
          });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown media composition error" },
      { status: 500 }
    );
  }
}
