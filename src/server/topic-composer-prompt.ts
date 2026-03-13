import type { ReplyMediaCandidate } from "@/src/lib/reply-composer";
import type { TopicPostDraft, TopicPostPlan, TopicPostRequest, TopicPostSubject } from "@/src/lib/topic-composer";

const STOP_SLOP_SKILL_PATH = "@.agents/skills/stop-slop/SKILL.md";
const NANO_BANANA_SKILL_NAME = "nano-banana";

function formatList(values: string[]): string {
  return values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : "- none";
}

function buildGoalGuidance(goal: TopicPostRequest["goal"]): string[] {
  switch (goal) {
    case "consequence":
      return [
        "- Treat consequence as second-order framing. Surface what this move changes downstream for creators, audiences, workflows, or incentives.",
        "- Make the follow-on effect more important than the announcement itself."
      ];
    case "contrarian":
      return [
        "- Treat contrarian as a real counter-read. Push against the lazy consensus or obvious company-centric framing.",
        "- The post should feel sharper than a recap, not just more negative."
      ];
    case "product":
      return [
        "- Treat product as a workflow or tooling lens. Focus on what this means for the product surface, user behavior, or production loop.",
        "- Prefer operational detail over executive or corporate theater."
      ];
    case "signal_boost":
      return [
        "- Treat signal_boost as a clean, forceful framing of why the topic matters now.",
        "- The post can sound declarative, but it still needs one specific angle."
      ];
    case "insight":
    default:
      return [
        "- Treat insight as the non-obvious read. Find the angle smart posters would wish they had said first."
      ];
  }
}

function stringifyJsonShape(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function buildCandidateBlock(candidate: ReplyMediaCandidate): string {
  const lines = [
    `candidate_id: ${candidate.candidateId}`,
    `usage_id: ${candidate.usageId}`,
    `asset_id: ${candidate.assetId ?? "unknown"}`,
    `tweet_id: ${candidate.tweetId ?? "unknown"}`,
    `tweet_url: ${candidate.tweetUrl ?? "unknown"}`,
    `author_username: ${candidate.authorUsername ?? "unknown"}`,
    `created_at: ${candidate.createdAt ?? "unknown"}`,
    `media_kind: ${candidate.mediaKind ?? "unknown"}`,
    `source_type: ${candidate.sourceType}`,
    `source_label: ${candidate.sourceLabel ?? "unknown"}`,
    `combined_score: ${candidate.combinedScore.toFixed(3)}`,
    `tweet_text: ${candidate.tweetText ?? ""}`,
    `match_reason: ${candidate.matchReason ?? "unknown"}`,
    `caption_brief: ${candidate.analysis?.captionBrief ?? "unknown"}`,
    `scene_description: ${candidate.analysis?.sceneDescription ?? "unknown"}`,
    `primary_emotion: ${candidate.analysis?.primaryEmotion ?? "unknown"}`,
    `conveys: ${candidate.analysis?.conveys ?? "unknown"}`,
    `rhetorical_role: ${candidate.analysis?.rhetoricalRole ?? "unknown"}`,
    `cultural_reference: ${candidate.analysis?.culturalReference ?? "unknown"}`,
    `analogy_target: ${candidate.analysis?.analogyTarget ?? "unknown"}`,
    `search_keywords: ${candidate.analysis?.searchKeywords.join(", ") || "none"}`,
    `display_url: ${candidate.displayUrl ?? "unknown"}`,
    `local_file_path: ${candidate.localFilePath ?? "unknown"}`,
    `video_file_path: ${candidate.videoFilePath ?? "unknown"}`
  ];

  if (candidate.localFilePath) {
    lines.push(`candidate_attachment: @${candidate.localFilePath}`);
  }

  return lines.join("\n");
}

export function buildTopicPostPlanPrompt(input: {
  request: TopicPostRequest;
  subject: TopicPostSubject;
}): string {
  const { request, subject } = input;

  return [
    `Before answering, load and follow ${STOP_SLOP_SKILL_PATH}.`,
    "You are planning a brand-new tweet from a topic cluster.",
    "Your job in this step is to decide the angle, tone, and best local-media retrieval queries.",
    "You are not writing the final tweet yet.",
    "Return raw JSON only. No markdown fences.",
    "",
    "Available tools after this step:",
    "- The application can run `x-media-analyst search facets --query <query> --format json` against a local media corpus.",
    "- Search works best with short retrieval phrases, mood descriptors, recognizable references, and concrete objects/scenes.",
    `- If the best move is to adapt an image rather than use it as-is, you may later choose an edit strategy that uses the ${NANO_BANANA_SKILL_NAME} skill.`,
    "",
    "Planning rules:",
    "- The tweet should feel like an original post, not a recap of the dashboard.",
    "- Use the topic's current heat, sample tweets, and grounded-news context if available.",
    "- Prefer a sharper angle than the representative tweets, not a paraphrase of them.",
    "- Search queries should target both message and visual tone.",
    "- Keep the final tweet plausibly postable under 280 characters.",
    ...buildGoalGuidance(request.goal),
    "",
    `Goal: ${request.goal}`,
    `Topic label: ${subject.label}`,
    `Topic kind: ${subject.kind}`,
    `Topic hotness: ${subject.hotnessScore.toFixed(2)}`,
    `Topic tweet_count: ${subject.tweetCount}`,
    `Topic recent_24h: ${subject.recentTweetCount24h}`,
    `Topic stale: ${subject.isStale ? "true" : "false"}`,
    `Most recent mention: ${subject.mostRecentAt ?? "unknown"}`,
    `Tone hint: ${request.toneHint ?? "none"}`,
    `Angle hint: ${request.angleHint ?? "none"}`,
    `Constraints: ${request.constraints ?? "none"}`,
    "",
    "Suggested angles:",
    formatList(subject.suggestedAngles),
    "",
    "Representative tweets:",
    ...subject.representativeTweets.map((tweet, index) => `- ${index + 1}. @${tweet.authorUsername ?? "unknown"}: ${tweet.text ?? ""}`),
    "",
    "Grounded news:",
    `- summary: ${subject.groundedNews?.summary ?? "none"}`,
    `- why_now: ${subject.groundedNews?.whyNow ?? "none"}`,
    `- sources: ${subject.groundedNews?.sources.map((source) => source.title).join(", ") || "none"}`,
    "",
    "Return JSON matching this shape exactly:",
    stringifyJsonShape({
      angle: "short explanation of the best original-post angle",
      tone: "short tone phrase",
      postIntent: "what this tweet is trying to do",
      targetReaction: "what readers should feel or realize",
      searchQueries: ["query one", "query two"],
      candidateSelectionCriteria: ["criterion one", "criterion two"],
      avoid: ["thing to avoid"]
    } satisfies TopicPostPlan)
  ].join("\n");
}

export function buildTopicPostPrompt(input: {
  request: TopicPostRequest;
  subject: TopicPostSubject;
  plan: TopicPostPlan;
  candidates: ReplyMediaCandidate[];
}): string {
  const { request, subject, plan, candidates } = input;

  return [
    `Before answering, load and follow ${STOP_SLOP_SKILL_PATH}.`,
    `If image editing would materially improve the result, you may invoke the ${NANO_BANANA_SKILL_NAME} skill to adapt a candidate image.`,
    "You are writing a brand-new tweet from a topic cluster and choosing one local media candidate.",
    "Return raw JSON only. No markdown fences.",
    "",
    "Tweet rules:",
    "- The tweet text must fit within 280 characters.",
    "- It should read like an original post, not commentary on the dashboard or notes about data.",
    "- Be specific and postable. Avoid generic 'big shift' language.",
    "- Use the planned angle, but tighten it into one clean tweet.",
    "- You may be witty, critical, bullish, dry, or analytical if it fits the topic and hints.",
    "- Match the requested goal. A consequence post should foreground downstream effects; a contrarian post should plainly reject the default framing; a product post should stay anchored on tooling or workflow behavior.",
    "- Keep `mediaSelectionReason`, `whyThisTweetWorks`, and `postingNotes` concise.",
    "- Choose `selectedCandidateId` only from the provided candidates.",
    "- If none fit, set `selectedCandidateId` to null and still return the best text-only tweet.",
    "",
    `Goal: ${request.goal}`,
    `Topic label: ${subject.label}`,
    `Tone hint: ${request.toneHint ?? "none"}`,
    `Angle hint: ${request.angleHint ?? "none"}`,
    `Constraints: ${request.constraints ?? "none"}`,
    "",
    "Planned direction:",
    `- angle: ${plan.angle}`,
    `- tone: ${plan.tone}`,
    `- post_intent: ${plan.postIntent}`,
    `- target_reaction: ${plan.targetReaction}`,
    "Selection criteria:",
    formatList(plan.candidateSelectionCriteria),
    "Avoid:",
    formatList(plan.avoid),
    "",
    "Representative tweets:",
    ...subject.representativeTweets.map((tweet, index) => `- ${index + 1}. @${tweet.authorUsername ?? "unknown"}: ${tweet.text ?? ""}`),
    "",
    `Grounded summary: ${subject.groundedNews?.summary ?? "none"}`,
    `Grounded why_now: ${subject.groundedNews?.whyNow ?? "none"}`,
    "",
    candidates.length > 0 ? "Candidates:" : "Candidates: none",
    candidates.map((candidate, index) => [`Candidate ${index + 1}`, buildCandidateBlock(candidate)].join("\n")).join("\n\n"),
    "",
    "Return JSON matching this shape exactly:",
    stringifyJsonShape({
      tweetText: "single tweet under 280 chars",
      selectedCandidateId: "candidate-1 or null",
      mediaSelectionReason: "why the chosen candidate fits the tweet",
      whyThisTweetWorks: "why the tweet and media pairing works",
      postingNotes: "optional posting note, or null"
    } satisfies TopicPostDraft)
  ].join("\n");
}
