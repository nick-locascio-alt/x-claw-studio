import { NextResponse } from "next/server";
import { topicPostRequestSchema, type TopicPostProgressEvent } from "@/src/lib/topic-composer";
import { createGeneratedDraft, markGeneratedDraftComplete, updateGeneratedDraft } from "@/src/server/generated-drafts";
import { composeTweetFromTopic, composeTweetsFromTopicForAllGoals } from "@/src/server/topic-composer";

export async function POST(request: Request) {
  try {
    const body = topicPostRequestSchema.parse(await request.json());
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        function write(event: unknown): void {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }

        const draftRecord = createGeneratedDraft({
          kind: "topic_post",
          topicId: body.topicId,
          requestGoal: body.goal,
          requestMode: body.mode,
          progressStage: "starting",
          progressMessage: "Starting topic composition"
        });

        try {
          const result = body.mode === "all_goals"
            ? await composeTweetsFromTopicForAllGoals(body, {
                onProgress(event: TopicPostProgressEvent) {
                  updateGeneratedDraft(draftRecord.draftId, {
                    progressStage: event.stage,
                    progressMessage: event.message,
                    progressDetail: event.detail ?? null
                  });
                  write({ type: "progress", ...event });
                }
              })
            : await composeTweetFromTopic(body, {
                onProgress(event: TopicPostProgressEvent) {
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
            kind: "topic_post",
            result
          });
          write({ type: "result", result });
          controller.close();
        } catch (error) {
          updateGeneratedDraft(draftRecord.draftId, {
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Unknown topic composition error"
          });
          write({
            type: "error",
            error: error instanceof Error ? error.message : "Unknown topic composition error"
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
      { error: error instanceof Error ? error.message : "Unknown topic composition error" },
      { status: 500 }
    );
  }
}
