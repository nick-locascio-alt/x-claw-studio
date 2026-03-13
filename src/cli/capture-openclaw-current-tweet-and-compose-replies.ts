import "@/src/lib/env";
import { runOpenClawCurrentCapture } from "@/src/server/openclaw-current-capture";
import { generateAllReplyDraftsForTweet } from "@/src/server/reply-composer-job";

async function run(): Promise<void> {
  const captureResult = await runOpenClawCurrentCapture({
    mode: "tweet_thread"
  });

  const tweetId = captureResult.topTweet?.tweetId;
  if (!tweetId) {
    throw new Error("Focused tweet capture finished, but no top tweet with an id was found for reply drafting.");
  }

  console.log(`Starting all-goals reply drafting for tweet ${tweetId}`);
  const result = await generateAllReplyDraftsForTweet(
    {
      tweetId,
      toneHint: "sharp but grounded",
      constraints: "keep it tight and postable"
    },
    {
      onProgress(event) {
        console.log(
          [
            "reply-compose:",
            `stage=${event.stage}`,
            event.goal ? `goal=${event.goal}` : null,
            `message=${event.message}`,
            event.detail ? `detail=${event.detail}` : null,
            typeof event.completedGoals === "number" ? `completed=${event.completedGoals}` : null,
            typeof event.totalGoals === "number" ? `total=${event.totalGoals}` : null
          ]
            .filter(Boolean)
            .join(" ")
        );
      }
    }
  );

  console.log(`Reply drafting complete. tweetId=${tweetId} drafts=${result.results.length}`);
}

run().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
