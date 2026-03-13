import type { MediaPostDraft, MediaPostPlan, MediaPostRequest, MediaPostSubject } from "@/src/lib/media-post-composer";
import type { ReplyMediaCandidate } from "@/src/lib/reply-composer";

const STOP_SLOP_SKILL_PATH = "@.agents/skills/stop-slop/SKILL.md";
const NANO_BANANA_SKILL_NAME = "nano-banana";

function formatList(values: string[]): string {
  return values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : "- none";
}

function stringifyJsonShape(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function buildMediaPostPlanPrompt(input: {
  request: MediaPostRequest;
  subject: MediaPostSubject;
}): string {
  const { request, subject } = input;
  const lines = [
    `Before answering, load and follow ${STOP_SLOP_SKILL_PATH}.`,
    "You are planning a brand-new tweet starting from one media asset.",
    "Your job in this step is to decide the best original-post angle for this media.",
    "You are not writing the final tweet yet.",
    "Return raw JSON only. No markdown fences.",
    "",
    "Planning rules:",
    "- The tweet should feel like an original post, not a reply or dashboard note.",
    "- Start from what the media communicates, then connect it to relevant active topics when useful.",
    "- Do not simply restate the old tweet that previously used this asset.",
    "- Prefer an angle that makes this asset newly useful now.",
    "- Plan 2 to 4 short search queries for alternate local media or imported meme templates that could beat the current asset.",
    "- Keep the final tweet plausibly postable under 280 characters.",
    "",
    `usage_id: ${subject.usageId}`,
    `asset_id: ${subject.assetId ?? "unknown"}`,
    `asset_usage_count: ${subject.assetUsageCount}`,
    `media_kind: ${subject.mediaKind}`,
    `author_username: ${subject.authorUsername ?? "unknown"}`,
    `created_at: ${subject.createdAt ?? "unknown"}`,
    `original_tweet_text: ${subject.tweetText ?? ""}`,
    `tone_hint: ${request.toneHint ?? "none"}`,
    `angle_hint: ${request.angleHint ?? "none"}`,
    `constraints: ${request.constraints ?? "none"}`,
    "",
    "Media analysis:",
    `- caption_brief: ${subject.analysis.captionBrief ?? "unknown"}`,
    `- scene_description: ${subject.analysis.sceneDescription ?? "unknown"}`,
    `- primary_emotion: ${subject.analysis.primaryEmotion ?? "unknown"}`,
    `- emotional_tone: ${subject.analysis.emotionalTone ?? "unknown"}`,
    `- conveys: ${subject.analysis.conveys ?? "unknown"}`,
    `- user_intent: ${subject.analysis.userIntent ?? "unknown"}`,
    `- rhetorical_role: ${subject.analysis.rhetoricalRole ?? "unknown"}`,
    `- text_media_relationship: ${subject.analysis.textMediaRelationship ?? "unknown"}`,
    `- cultural_reference: ${subject.analysis.culturalReference ?? "unknown"}`,
    `- analogy_target: ${subject.analysis.analogyTarget ?? "unknown"}`,
    `- trend_signal: ${subject.analysis.trendSignal ?? "unknown"}`,
    `- audience_takeaway: ${subject.analysis.audienceTakeaway ?? "unknown"}`,
    `- brand_signals: ${subject.analysis.brandSignals.join(", ") || "none"}`,
    `- search_keywords: ${subject.analysis.searchKeywords.join(", ") || "none"}`,
    "",
    "Relevant topics:",
    ...subject.relatedTopics.map(
      (topic) =>
        `- ${topic.label} | hot ${topic.hotnessScore.toFixed(1)} | ${topic.stance} | ${topic.sentiment} | ${topic.whyNow ?? "no why-now"}`
    ),
    "",
    "Prior usages of this asset:",
    ...subject.priorUsages.map(
      (usage, index) => `- ${index + 1}. @${usage.authorUsername ?? "unknown"} (${usage.createdAt ?? "unknown"}): ${usage.tweetText ?? ""}`
    ),
    ""
  ];

  if (subject.localFilePath) {
    lines.push(`asset_attachment: @${subject.localFilePath}`);
  } else if (subject.playableFilePath) {
    lines.push(`asset_attachment: @${subject.playableFilePath}`);
  }

  lines.push(
    "",
    "Return JSON matching this shape exactly:",
    stringifyJsonShape({
      angle: "short explanation of the best original-post angle",
      tone: "short tone phrase",
      postIntent: "what this tweet is trying to do",
      targetReaction: "what readers should feel or realize",
      searchQueries: ["query one", "query two"],
      candidateSelectionCriteria: ["criterion one", "criterion two"],
      supportingTopics: ["topic one", "topic two"],
      avoid: ["thing to avoid"]
    } satisfies MediaPostPlan)
  );

  return lines.join("\n");
}

function buildCandidateBlock(candidate: ReplyMediaCandidate): string {
  const lines = [
    `candidate_id: ${candidate.candidateId}`,
    `usage_id: ${candidate.usageId ?? "unknown"}`,
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
  } else if (candidate.videoFilePath) {
    lines.push(`candidate_attachment: @${candidate.videoFilePath}`);
  }

  return lines.join("\n");
}

export function buildMediaPostPrompt(input: {
  request: MediaPostRequest;
  subject: MediaPostSubject;
  plan: MediaPostPlan;
  candidates: ReplyMediaCandidate[];
}): string {
  const { request, subject, plan, candidates } = input;
  const lines = [
    `Before answering, load and follow ${STOP_SLOP_SKILL_PATH}.`,
    `If image editing would materially improve the result, you may invoke the ${NANO_BANANA_SKILL_NAME} skill to adapt a candidate image.`,
    "You are writing a brand-new tweet around one media asset and may choose a better local candidate if it fits the angle better.",
    "Return raw JSON only. No markdown fences.",
    "",
    "Tweet rules:",
    "- The tweet text must fit within 280 characters.",
    "- It should read like an original post, not a reply and not a note about analytics.",
    "- Use the media as the anchor. The tweet should make the chosen asset or template feel relevant now.",
    "- You may connect it to one active topic, but do not turn it into a generic headline recap.",
    "- Be specific and postable. Avoid filler, vague trend language, and obvious thesis statements.",
    "- Choose `selectedCandidateId` only from the provided candidate IDs, or null if the current asset is best as-is.",
    "- Keep `mediaSelectionReason`, `whyThisTweetWorks`, and `postingNotes` concise.",
    "",
    `tone_hint: ${request.toneHint ?? "none"}`,
    `angle_hint: ${request.angleHint ?? "none"}`,
    `constraints: ${request.constraints ?? "none"}`,
    `asset_id: ${subject.assetId ?? "unknown"}`,
    `media_kind: ${subject.mediaKind}`,
    `original_tweet_text: ${subject.tweetText ?? ""}`,
    "",
    "Media analysis:",
    `- caption_brief: ${subject.analysis.captionBrief ?? "unknown"}`,
    `- scene_description: ${subject.analysis.sceneDescription ?? "unknown"}`,
    `- primary_emotion: ${subject.analysis.primaryEmotion ?? "unknown"}`,
    `- emotional_tone: ${subject.analysis.emotionalTone ?? "unknown"}`,
    `- conveys: ${subject.analysis.conveys ?? "unknown"}`,
    `- rhetorical_role: ${subject.analysis.rhetoricalRole ?? "unknown"}`,
    `- cultural_reference: ${subject.analysis.culturalReference ?? "unknown"}`,
    `- analogy_target: ${subject.analysis.analogyTarget ?? "unknown"}`,
    `- trend_signal: ${subject.analysis.trendSignal ?? "unknown"}`,
    "",
    "Relevant topics:",
    formatList(plan.supportingTopics),
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
    candidates.length > 0 ? "Candidates:" : "Candidates: none",
    candidates.map((candidate, index) => [`Candidate ${index + 1}`, buildCandidateBlock(candidate)].join("\n")).join("\n\n"),
    ""
  ];

  if (subject.localFilePath) {
    lines.push(`asset_attachment: @${subject.localFilePath}`);
  } else if (subject.playableFilePath) {
    lines.push(`asset_attachment: @${subject.playableFilePath}`);
  }

  lines.push(
    "",
    "Return JSON matching this shape exactly:",
    stringifyJsonShape({
      tweetText: "single tweet under 280 chars",
      selectedCandidateId: "candidate-1 or null",
      mediaSelectionReason: "why the chosen candidate or current asset fits the tweet",
      whyThisTweetWorks: "why the tweet fits the media and current moment",
      postingNotes: "optional posting note, or null"
    } satisfies MediaPostDraft)
  );

  return lines.join("\n");
}
