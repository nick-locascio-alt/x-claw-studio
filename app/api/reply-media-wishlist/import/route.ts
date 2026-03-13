import { NextResponse } from "next/server";
import { z } from "zod";
import type { MemeTemplateImportProgressEvent } from "@/src/lib/meme-template";
import { importWishlistMemeFromMemingWorld } from "@/src/server/meme-template-import";

const requestSchema = z.object({
  key: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        function write(event: unknown): void {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }

        try {
          const result = await importWishlistMemeFromMemingWorld(body.key, {
            onProgress(event: MemeTemplateImportProgressEvent) {
              write({ type: "progress", ...event });
            }
          });

          write({
            type: "result",
            result: {
              key: result.key,
              title: result.title,
              pageUrl: result.pageUrl
            }
          });
          controller.close();
        } catch (error) {
          write({
            type: "error",
            error: error instanceof Error ? error.message : "Unknown meme import error"
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
      { error: error instanceof Error ? error.message : "Unknown meme import error" },
      { status: 500 }
    );
  }
}
