import { describe, expect, it } from "vitest";
import type { TopicSearchResult } from "@/src/server/chroma-facets";
import { buildAgentTopicSearchPayload, parseSearchTopicCliArgs } from "@/src/cli/search-topics";

describe("parseSearchTopicCliArgs", () => {
  it("accepts flag-based arguments", () => {
    expect(parseSearchTopicCliArgs(["--query", "OpenAI pricing backlash", "--limit", "5", "--jsonl"])).toMatchObject({
      query: "OpenAI pricing backlash",
      limit: 5,
      format: "jsonl"
    });
  });

  it("accepts positional arguments", () => {
    expect(parseSearchTopicCliArgs(["Cloudflare crawl API"])).toMatchObject({
      query: "Cloudflare crawl API",
      limit: 12,
      format: "json"
    });
  });
});

describe("buildAgentTopicSearchPayload", () => {
  it("emits a topic-oriented payload with posture and usage links", () => {
    const result: TopicSearchResult = {
      query: "OpenAI pricing backlash",
      limit: 5,
      results: [
        {
          id: "topic-1",
          document: "summary_label: OpenAI Pricing Backlash\nstance: critical",
          metadata: {
            analysis_scope: "topic_tweet",
            analysis_id: "topic-1"
          },
          tweet: {
            tweetKey: "tweet-1",
            tweetId: "tweet-1",
            authorUsername: "example",
            text: "Everyone is mad about OpenAI pricing again.",
            createdAt: "2026-03-11T10:00:00.000Z"
          },
          topic: {
            topicId: "phrase:openai-pricing-backlash",
            label: "OpenAI Pricing Backlash",
            hotnessScore: 7.2,
            tweetCount: 4,
            isStale: false
          },
          analysis: {
            analysisId: "topic-1",
            summaryLabel: "OpenAI Pricing Backlash",
            isNews: true,
            newsPeg: "price changes for API buyers",
            whyNow: "More teams are reacting to repricing this week.",
            sentiment: "negative",
            stance: "critical",
            emotionalTone: "frustrated",
            opinionIntensity: "high",
            targetEntity: "OpenAI",
            signals: ["OpenAI Pricing Backlash", "API Repricing"]
          },
          usageIds: ["usage-1"],
          vectorDistance: 0.3,
          vectorScore: 0.8,
          lexicalScore: 0.7,
          combinedScore: 0.765,
          matchedBy: ["vector", "lexical"]
        }
      ]
    };

    const payload = buildAgentTopicSearchPayload(result);

    expect(payload).toMatchObject({
      command: "search-topics",
      query: "OpenAI pricing backlash",
      result_count: 1
    });
    expect(payload.results[0]).toMatchObject({
      topic: {
        label: "OpenAI Pricing Backlash",
        tweet_count: 4
      },
      analysis: {
        stance: "critical",
        sentiment: "negative",
        target_entity: "OpenAI"
      },
      usage_ids: ["usage-1"]
    });
  });
});
