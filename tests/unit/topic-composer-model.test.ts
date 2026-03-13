import { beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiCliTopicComposerModel } from "@/src/server/topic-composer-model";
import type { TopicPostRequest, TopicPostSubject } from "@/src/lib/topic-composer";

const { runGeminiPromptMock } = vi.hoisted(() => ({
  runGeminiPromptMock: vi.fn()
}));

vi.mock("@/src/server/gemini-cli-json", async () => {
  const actual = await vi.importActual<typeof import("@/src/server/gemini-cli-json")>("@/src/server/gemini-cli-json");

  return {
    ...actual,
    runGeminiPrompt: runGeminiPromptMock
  };
});

const request: TopicPostRequest = {
  topicId: "topic-1",
  goal: "insight",
  mode: "single",
  toneHint: "sharp and specific",
  angleHint: "second-order and contrarian",
  constraints: "keep it punchy and postable"
};

const subject: TopicPostSubject = {
  topicId: "topic-1",
  label: "Ben Affleck AI Film Deal",
  kind: "news",
  hotnessScore: 9.7,
  tweetCount: 124,
  recentTweetCount24h: 83,
  isStale: false,
  mostRecentAt: "2026-03-11T17:00:00.000Z",
  suggestedAngles: ["The product implication matters more than the press-release framing."],
  representativeTweets: [
    {
      authorUsername: "example",
      text: "Ben Affleck signs AI film deal.",
      createdAt: "2026-03-11T17:00:00.000Z"
    }
  ],
  groundedNews: {
    summary: "Affleck attached his name to an AI-assisted film production deal.",
    whyNow: "The announcement pulled film-tech discourse back toward tooling and workflow.",
    sources: [{ title: "Example", uri: "https://example.com" }]
  }
};

describe("GeminiCliTopicComposerModel", () => {
  beforeEach(() => {
    runGeminiPromptMock.mockReset();
  });

  it("trims and dedupes oversized search query lists before schema validation", async () => {
    runGeminiPromptMock.mockResolvedValue(
      JSON.stringify({
        response: JSON.stringify({
          angle: "The real shift is workflow productization, not celebrity endorsement.",
          tone: "sharp and specific",
          postIntent: "Reframe the story around tool behavior.",
          targetReaction: "Make the product consequence feel more interesting than the deal.",
          searchQueries: [
            "studio control room",
            "editing suite tension",
            "studio control room",
            "assembly line cinema",
            "AI storyboard chaos"
          ],
          candidateSelectionCriteria: ["feels industrial", "supports the workflow angle"],
          avoid: ["celebrity worship"]
        })
      })
    );

    const model = new GeminiCliTopicComposerModel();
    const plan = await model.planPost({ request, subject });

    expect(plan.searchQueries).toEqual([
      "studio control room",
      "editing suite tension",
      "assembly line cinema",
      "AI storyboard chaos"
    ]);
  });
});
