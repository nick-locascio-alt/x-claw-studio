import { buildUsageId } from "@/src/lib/usage-id";
import type { ExtractedTweet } from "@/src/lib/types";

export type GeminiAnalysisPromptVariant = "baseline" | "cultural_audit";
export type GeminiAnalysisPromptMediaMode = "image_or_usage_media" | "video_asset";

function buildSharedPromptLines(tweet: ExtractedTweet, mediaIndex: number): string[] {
  const media = tweet.media[mediaIndex];

  return [
    "Analyze this single X/Twitter tweet media usage.",
    "Return only JSON matching the provided schema.",
    "Use concise but information-dense values.",
    "All field names must remain exactly as provided.",
    "If a field is uncertain, provide the best grounded inference and explain uncertainty in confidence_notes.",
    "",
    `usageId: ${buildUsageId(tweet, mediaIndex)}`,
    `tweetId: ${tweet.tweetId ?? "unknown"}`,
    `author_username: ${tweet.authorUsername ?? "unknown"}`,
    `author_display_name: ${tweet.authorDisplayName ?? "unknown"}`,
    `tweet_url: ${tweet.tweetUrl ?? "unknown"}`,
    `created_at: ${tweet.createdAt ?? "unknown"}`,
    `tweet_text: ${tweet.text ?? ""}`,
    `likes: ${tweet.metrics.likes ?? "unknown"}`,
    `reposts: ${tweet.metrics.reposts ?? "unknown"}`,
    `replies: ${tweet.metrics.replies ?? "unknown"}`,
    `views: ${tweet.metrics.views ?? "unknown"}`,
    `media_kind: ${media.mediaKind}`,
    `media_source_url: ${media.sourceUrl ?? "unknown"}`,
    `media_poster_url: ${media.posterUrl ?? "unknown"}`,
    ""
  ];
}

function buildVariantGuidance(variant: GeminiAnalysisPromptVariant): string[] {
  if (variant === "baseline") {
    return [];
  }

  return [
    "Reasoning priorities before writing fields:",
    "- First identify the literal image contents.",
    "- Then identify whether the image appears to reference a specific person, fictional character, TV show, film, game, meme template, or other cultural artifact.",
    "- Then explain how the tweet text and the referenced source material interact.",
    "- If you identify a character or scene, determine which specific plotline, role, behavior, or reputation from the source material is being invoked here.",
    "- Internally test three levels of analogy: personal vibe, company/startup behavior, and country/market rivalry. Use the most specific level that is grounded.",
    "- Prefer a specific identification over a generic archetype when the image plausibly points to a known reference.",
    "- If you suspect a reference but cannot confidently name it, say that explicitly in cultural_reference or confidence_notes instead of inventing details.",
    "",
    "Internal checklist:",
    "- Who exactly is in the image?",
    "- What exact plotline, role, or recurring behavior is that person known for in the source material?",
    "- Which words in the tweet text point toward that plotline?",
    "- Does the analogy operate at the level of a person, startup, company, nation, or market?",
    "- Are there cross-company, cross-country, or knockoff dynamics that are more specific than generic 'hacker' behavior?",
    "- For analogy_scope, prefer the broadest grounded scope implicated by the joke. Do not default to 'personal' if the text and reference clearly point to company, market, or geopolitical dynamics.",
    "",
    "Cultural reference audit:",
    "- Check for recognizable actors, characters, scenes, costumes, publicity stills, screenshots from TV/film, or widely reused reaction images.",
    "- Check whether the post's joke depends on knowing the source text's plot, character role, reputation, stereotype, business behavior, or geopolitical context.",
    "- When tweet text mentions copying, distillation, cloning, imitation, theft, startup competition, or national rivalry, test whether the chosen character or scene is known for a parallel behavior in the source material.",
    "- If the relevant plotline involves copying an idea across companies, countries, or markets, include that cross-border or market-copying detail when it materially sharpens the analogy.",
    "- For cultural_reference, name the source material and character when grounded by the image and text.",
    "- For cultural_reference, include the relevant plotline or role if that is central to the joke.",
    "- Fill reference_entity with the most specific named entity available, like a character or person.",
    "- Fill reference_source with the source work, franchise, platform, event, or domain the reference comes from.",
    "- Fill reference_plot_context with the specific plotline, role, recurring behavior, or historical context that the joke depends on.",
    "- Fill analogy_target with the modern situation being mapped onto that reference.",
    "- Fill analogy_scope with the level of the analogy, such as personal, company, market, geopolitical, or a combination.",
    "- reference_plot_context and analogy_scope should capture the substance of the comparison, not just the character's vibe.",
    "- For metaphor, user_intent, humor_mechanism, why_it_works, and audience_takeaway, explain the holistic analogy created by combining tweet text with that cultural reference.",
    "- If the analogy depends on a specific storyline, describe that storyline briefly instead of reducing it to generic 'chaotic hacker energy'.",
    "- Do not stop at generic descriptions like 'shady hacker' or 'chaotic tech energy' if the image likely encodes a more specific joke."
  ];
}

function buildFacetGuidance(mode: GeminiAnalysisPromptMediaMode): string[] {
  const shared = [
    "Facet guidance:",
    "- has_celebrity: true if the media clearly contains a widely recognizable public figure or celebrity; false otherwise.",
    "- has_human_face: true if one or more human faces are visibly present; false otherwise.",
    "- features_female: true if a prominent depicted person appears female-presenting; false otherwise. This may coexist with features_male in group shots.",
    "- features_male: true if a prominent depicted person appears male-presenting; false otherwise. This may coexist with features_female in group shots.",
    "- has_screenshot_ui: true if the media is mainly a screenshot of software, a webpage, a terminal, a dashboard, or app UI; false otherwise.",
    "- has_text_overlay: true if there is prominent text rendered inside the media itself, beyond tiny incidental text; false otherwise.",
    "- has_chart_or_graph: true if a chart, graph, market candle chart, axis plot, or diagram is a major visual element; false otherwise.",
    "- has_logo_or_watermark: true if a logo, brand mark, or watermark is visibly embedded in the media; false otherwise.",
    "- caption_brief: literal one-sentence caption of the media.",
    "- scene_description: fuller visual description.",
    "- video_music / video_sound / video_action: these are video-only fields. For still images, set them to null.",
    "- cultural_reference: identify any specific show, film, character, actor, meme template, historical event, or other external reference that is materially relevant to the joke or meaning. Include the relevant role, plotline, reputation, and any cross-company or cross-country copying dynamic when important.",
    "- reference_entity: the most specific named entity involved in the reference, such as a character, actor, politician, company, product, or meme template name.",
    "- reference_source: the broader source or canon, such as a TV show, movie, franchise, platform, historical event, or internet subculture.",
    "- reference_plot_context: the specific plotline, role, business behavior, or context from the source material that makes the analogy work. Prefer the concrete behavior being referenced over general personality traits.",
    "- analogy_target: the real-world target of the analogy in this tweet, described in searchable terms. Include both specific and general wording when useful.",
    "- analogy_scope: the level at which the analogy operates, such as personal, team, company, market, geopolitical, or mixed. Choose the broadest grounded level supported by both the tweet text and the source-material callback.",
    "- metaphor: implied analogy or symbolic pairing between media and text. If a cultural reference is central, explain the source-material parallel rather than restating the image literally.",
    "- user_intent: why the author likely chose this exact media here, including any reference-dependent joke, comparison, or storyline mapping.",
    "- humor_mechanism: if humorous, explain the comedic mechanism such as analogy, incongruity, satire, character-based reference, plot callback, exaggeration, or role reversal.",
    "- why_it_works: explain why this pairing is legible and effective for the likely online audience, including any specific plot knowledge that makes the joke sharper.",
    "- primary_emotion: the single dominant emotion the media conveys most strongly, like anxiety, awe, excitement, humor, confidence, dread, curiosity, or calm.",
    "- conveys: what social/emotional message the post communicates.",
    "- rhetorical_role: reaction, evidence, explainer, meme, flex, announcement, fear signal, etc.",
    "- text_media_relationship: how the tweet text and media reinforce, contrast, or reframe each other.",
    "- trend_signal: why this media could travel or get reused.",
    "- reuse_pattern: how other posters might reuse the same asset archetype.",
    "- search_keywords: short retrieval-oriented keywords, not full sentences. Include a mix of specific proper nouns and broader category terms so both exact and fuzzy search work."
  ];

  if (mode === "video_asset") {
    return [
      ...shared,
      "Video-specific guidance:",
      "- Because this is a video, treat video_music, video_sound, and video_action as first-class fields and fill them whenever they are observable.",
      "- For video_music, mention whether music is present, what kind it is, and what mood or pacing it creates. If there is clearly no music, say so.",
      "- For video_sound, describe dialogue, ambient sound, sound effects, crowd noise, silence, or audio absence/uncertainty.",
      "- For video_action, summarize the temporal sequence of visible actions or shot progression across the clip."
    ];
  }

  return shared;
}

export function buildTweetMediaAnalysisPrompt(
  tweet: ExtractedTweet,
  mediaIndex: number,
  variant: GeminiAnalysisPromptVariant = "cultural_audit"
): string {
  return [
    ...buildSharedPromptLines(tweet, mediaIndex),
    ...buildVariantGuidance(variant),
    ...buildFacetGuidance("image_or_usage_media")
  ].join("\n");
}

export function buildVideoAssetAnalysisPrompt(input: {
  assetId: string;
  mediaKind: string;
  canonicalMediaUrl: string | null;
  canonicalPosterUrl: string | null;
  representativeUsageId: string | null;
  representativeAuthorUsername: string | null;
  representativeTweetText: string | null;
}): string {
  return [
    "Analyze this full video media asset independent of a single tweet usage.",
    "Return only JSON matching the provided schema.",
    "Use the same facet structure as image analysis.",
    "Focus on the media itself first, but use the representative tweet context when helpful for rhetorical interpretation.",
    "Use concise but information-dense values.",
    "All field names must remain exactly as provided.",
    "If a field is uncertain, provide the best grounded inference and explain uncertainty in confidence_notes.",
    "",
    `asset_id: ${input.assetId}`,
    `media_kind: ${input.mediaKind}`,
    `canonical_media_url: ${input.canonicalMediaUrl ?? "unknown"}`,
    `canonical_poster_url: ${input.canonicalPosterUrl ?? "unknown"}`,
    `representative_usage_id: ${input.representativeUsageId ?? "unknown"}`,
    `representative_author_username: ${input.representativeAuthorUsername ?? "unknown"}`,
    `representative_tweet_text: ${input.representativeTweetText ?? ""}`,
    "",
    ...buildFacetGuidance("video_asset")
  ].join("\n");
}
