import type {
  ReplyCompositionDraft,
  ReplyCompositionPlan,
  ReplyCompositionRequest,
  ReplyComposerSubject,
  ReplyMediaCandidate
} from "@/src/lib/reply-composer";

const STOP_SLOP_SKILL_PATH = "@.agents/skills/stop-slop/SKILL.md";
const NANO_BANANA_SKILL_NAME = "nano-banana";

function buildGoalStanceGuidance(goal: ReplyCompositionRequest["goal"]): string[] {
  switch (goal) {
    case "support":
      return [
        "- Treat support as reinforcement. The reply should clearly back the tweet's core point unless the subject is internally inconsistent.",
        "- A supportive reply can add a new angle, but it should still read as agreement."
      ];
    case "signal_boost":
      return [
        "- Treat signal_boost as amplification. The reply should extend or sharpen the tweet while staying aligned with its core point."
      ];
    case "critique":
      return [
        "- Treat critique as real pushback. Challenge the premise, expose a missing assumption, or redirect the blame.",
        "- Do not merely agree with the tweet in a harsher tone. If you mostly agree, choose a different stance."
      ];
    case "consequence":
      return [
        "- Consequence can agree or disagree. Pick the stance that makes the second-order effect most legible."
      ];
    case "insight":
    default:
      return [
        "- Insight can agree, disagree, or mix both. Pick the stance that yields the most interesting non-obvious reply."
      ];
  }
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : "- none";
}

function stringifyJsonShape(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function buildReplyCompositionPlanPrompt(input: {
  request: ReplyCompositionRequest;
  subject: ReplyComposerSubject;
}): string {
  const { request, subject } = input;

  return [
    `Before answering, load and follow ${STOP_SLOP_SKILL_PATH}.`,
    "You are planning a reply to a subject tweet for an operator who will pair the reply text with one media asset from a local corpus.",
    "Your job in this step is to decide the best response angle and the best media search queries.",
    "The reply should add value by pointing out an aspect, consequence, implication, support case, or sharper framing of the subject tweet.",
    "You are not writing the final reply yet.",
    "Return raw JSON only. No markdown fences.",
    "",
    "Available tools after this step:",
    "- The application can run `x-media-analyst search facets --query <query> --format json` against a local media corpus.",
    "- Search works best with short, retrieval-oriented phrases and named references, not long prose.",
    "- The final step can inspect candidate media metadata and attached local images/videos before choosing one.",
    `- If the best move is to adapt an image rather than use it as-is, you may choose an edit strategy that would later use the ${NANO_BANANA_SKILL_NAME} skill.`,
    "",
    "Planning rules:",
    "- First decide the reply stance toward the subject tweet: agree, disagree, or mixed.",
    "- Search queries should target mood, message, and recognizable references that fit the response angle.",
    "- Queries can point to meme templates, real people, public figures, fictional characters, pop-culture scenes, historical events, visual metaphors, objects, concepts, or vibes.",
    "- For image media, you may plan around an edited meme variant, a documentary/news image, a character still, a reaction photo, or an untouched source image.",
    "- Prefer 2 to 4 queries that vary between literal, metaphorical, and cultural-reference retrieval terms.",
    "- Avoid simply restating the tweet. The reply should add an angle.",
    "- Keep the final reply plausibly postable as a single X reply under 280 characters.",
    ...buildGoalStanceGuidance(request.goal),
    "",
    `Goal: ${request.goal}`,
    `Tone hint: ${request.toneHint ?? "none"}`,
    `Angle hint: ${request.angleHint ?? "none"}`,
    `Constraints: ${request.constraints ?? "none"}`,
    "",
    `Subject usageId: ${subject.usageId ?? "none"}`,
    `Subject tweetId: ${subject.tweetId ?? "unknown"}`,
    `Subject tweet URL: ${subject.tweetUrl ?? "unknown"}`,
    `Subject author: ${subject.authorUsername ?? "unknown"}`,
    `Subject created_at: ${subject.createdAt ?? "unknown"}`,
    `Subject media_kind: ${subject.mediaKind}`,
    `Subject tweet text: ${subject.tweetText ?? ""}`,
    "",
    "Subject media analysis:",
    `- caption_brief: ${subject.analysis.captionBrief ?? "unknown"}`,
    `- scene_description: ${subject.analysis.sceneDescription ?? "unknown"}`,
    `- primary_emotion: ${subject.analysis.primaryEmotion ?? "unknown"}`,
    `- conveys: ${subject.analysis.conveys ?? "unknown"}`,
    `- user_intent: ${subject.analysis.userIntent ?? "unknown"}`,
    `- rhetorical_role: ${subject.analysis.rhetoricalRole ?? "unknown"}`,
    `- text_media_relationship: ${subject.analysis.textMediaRelationship ?? "unknown"}`,
    `- cultural_reference: ${subject.analysis.culturalReference ?? "unknown"}`,
    `- analogy_target: ${subject.analysis.analogyTarget ?? "unknown"}`,
    `- search_keywords: ${subject.analysis.searchKeywords.join(", ") || "none"}`,
    "",
    "Return JSON matching this shape exactly:",
    stringifyJsonShape({
      stance: "agree, disagree, or mixed",
      angle: "short explanation of the best response angle",
      tone: "short tone phrase",
      intentSummary: "what the reply is trying to do",
      targetEffect: "what the reader should feel or realize",
      searchQueries: ["query one", "query two"],
      moodKeywords: ["keyword one", "keyword two"],
      candidateSelectionCriteria: ["criterion one", "criterion two"],
      avoid: ["thing to avoid"]
    })
  ].join("\n");
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

export function buildReplyCompositionPrompt(input: {
  request: ReplyCompositionRequest;
  subject: ReplyComposerSubject;
  plan: ReplyCompositionPlan;
  candidates: ReplyMediaCandidate[];
}): string {
  const { request, subject, plan, candidates } = input;

  return [
    `Before answering, load and follow ${STOP_SLOP_SKILL_PATH}.`,
    `If image editing would materially improve the result, you may invoke the ${NANO_BANANA_SKILL_NAME} skill to adapt a candidate image.`,
    "You are finalizing a reply to a subject tweet.",
    "Write one strong reply and choose the single best media candidate from the provided local corpus results.",
    "Return raw JSON only. No markdown fences.",
    "",
    "Reply rules:",
    "- The reply text must fit within 280 characters.",
    "- It should sound like a real post, not analysis notes.",
    "- It should add angle, implication, support, or consequence rather than paraphrasing the original tweet.",
    "- It may be witty, sharp, supportive, or analytical as long as it matches the requested goal.",
    "- Match the planned stance. If the stance is disagree, the reply should plainly push back on the tweet's premise or framing.",
    "- If the goal is critique, do not return a reply that mostly agrees with the tweet.",
    "- Prefer specificity over generic internet tone.",
    "- Keep `mediaSelectionReason`, `whyThisReplyWorks`, and `postingNotes` concise: one or two short sentences each, ideally under 180 characters.",
    "- Choose `selectedCandidateId` only from the provided candidate IDs.",
    "- If none of the candidates fit, set `selectedCandidateId` to null and still return the best text-only reply.",
    "- If you select an image candidate, you may also decide that it should be edited to fit the subject better.",
    "- For image candidates, allowed edit strategies include adding meme text, rewriting captions, swapping a face for a relevant public figure, replacing an object for stronger comedic effect, or otherwise editing the image to sharpen the joke.",
    "- Examples of valid edits: replace one original subject's face with a founder, politician, or company figure relevant to the tweet; replace an item or prop with the product, policy, or controversy being discussed; add top/bottom text or panel captions that make the angle land faster.",
    "- Only propose edits that preserve the meme's recognizability and make the reply/media pairing more legible.",
    "",
    `Goal: ${request.goal}`,
    `Tone hint: ${request.toneHint ?? "none"}`,
    `Angle hint: ${request.angleHint ?? "none"}`,
    `Constraints: ${request.constraints ?? "none"}`,
    "",
    "Planned angle:",
    `- stance: ${plan.stance}`,
    `- angle: ${plan.angle}`,
    `- tone: ${plan.tone}`,
    `- intent_summary: ${plan.intentSummary}`,
    `- target_effect: ${plan.targetEffect}`,
    "Selection criteria:",
    formatList(plan.candidateSelectionCriteria),
    "Avoid:",
    formatList(plan.avoid),
    "",
    `Subject tweet text: ${subject.tweetText ?? ""}`,
    `Subject author: ${subject.authorUsername ?? "unknown"}`,
    `Subject media analysis conveys: ${subject.analysis.conveys ?? "unknown"}`,
    `Subject media analysis cultural_reference: ${subject.analysis.culturalReference ?? "unknown"}`,
    `Subject media kind: ${subject.mediaKind}`,
    "",
    candidates.length > 0 ? "Candidates:" : "Candidates: none",
    candidates.map((candidate, index) => [`Candidate ${index + 1}`, buildCandidateBlock(candidate)].join("\n")).join("\n\n"),
    "",
    "Return JSON matching this shape exactly:",
    stringifyJsonShape({
      replyText: "single reply text under 280 chars",
      selectedCandidateId: "candidate-1 or null",
      mediaSelectionReason: "why the chosen candidate fits the reply",
      whyThisReplyWorks: "why the text and media pairing works",
      postingNotes: "optional caveat or posting note, or null"
    } satisfies ReplyCompositionDraft)
  ].join("\n");
}
