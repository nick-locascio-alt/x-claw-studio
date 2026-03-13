import { NextResponse } from "next/server";
import {
  replyCompositionRequestSchema,
  type ReplyCompositionProgressEvent
} from "@/src/lib/reply-composer";
import { createGeneratedDraft, markGeneratedDraftComplete, updateGeneratedDraft } from "@/src/server/generated-drafts";
import { composeReplyForUsage, composeRepliesForAllGoals } from "@/src/server/reply-composer";

export async function POST(request: Request) {
  try {
    const body = replyCompositionRequestSchema.parse(await request.json());
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        function write(event: unknown): void {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }

        const draftRecord = createGeneratedDraft({
          kind: "reply",
          usageId: body.usageId ?? null,
          tweetId: body.tweetId ?? null,
          requestGoal: body.goal,
          requestMode: body.mode,
          progressStage: "starting",
          progressMessage: "Starting reply composition"
        });

        try {
          const runCompose =
            body.mode === "all_goals"
              ? composeRepliesForAllGoals(body, {
                  onProgress(event: ReplyCompositionProgressEvent) {
                    updateGeneratedDraft(draftRecord.draftId, {
                      progressStage: event.stage,
                      progressMessage: event.message,
                      progressDetail: event.detail ?? null
                    });
                    write({ type: "progress", ...event });
                  }
                })
              : composeReplyForUsage(body, {
                  onProgress(event: ReplyCompositionProgressEvent) {
                    updateGeneratedDraft(draftRecord.draftId, {
                      progressStage: event.stage,
                      progressMessage: event.message,
                      progressDetail: event.detail ?? null
                    });
                    write({ type: "progress", ...event });
                  }
                });

          const result = await runCompose;
          markGeneratedDraftComplete({
            draftId: draftRecord.draftId,
            kind: "reply",
            result
          });

          write({ type: "result", result });
          controller.close();
        } catch (error) {
          updateGeneratedDraft(draftRecord.draftId, {
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Unknown reply composition error"
          });
          write({
            type: "error",
            error: error instanceof Error ? error.message : "Unknown reply composition error"
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
      { error: error instanceof Error ? error.message : "Unknown reply composition error" },
      { status: 500 }
    );
  }
}
