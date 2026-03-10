import type { ExtractedTweet } from "@/src/lib/types";

export function buildUsageId(tweet: ExtractedTweet, mediaIndex: number): string {
  return `${tweet.tweetId ?? tweet.sourceName}-${mediaIndex}`;
}
