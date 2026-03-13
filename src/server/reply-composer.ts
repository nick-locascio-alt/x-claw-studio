import type {
  ReplyCompositionBatchResult,
  ReplyCompositionProgressEvent,
  ReplyCompositionRequest,
  ReplyCompositionResult,
  ReplyComposerSubject
} from "@/src/lib/reply-composer";
import { findTweetById } from "@/src/server/tweet-repository";
import { getUsageDetail } from "@/src/server/usage-details";
import { createReplyComposerModel } from "@/src/server/reply-composer-model";
import { CliFacetReplyMediaSearchProvider } from "@/src/server/reply-media-search";
import { REPLY_COMPOSITION_GOALS } from "@/src/lib/reply-composer";
import { recordReplyMediaWishlist } from "@/src/server/reply-media-wishlist";
import { composeAllGoals } from "@/src/server/composer-batch";

async function buildSubject(request: ReplyCompositionRequest): Promise<ReplyComposerSubject> {
  if (request.usageId) {
    const detail = await getUsageDetail(request.usageId);
    if (!detail) {
      throw new Error(`Usage ${request.usageId} was not found`);
    }

    return {
      usageId: detail.usageId,
      tweetId: detail.tweet.tweetId,
      tweetUrl: detail.tweet.tweetUrl,
      authorUsername: detail.tweet.authorUsername,
      createdAt: detail.tweet.createdAt,
      tweetText: detail.tweet.text,
      mediaKind: detail.analysis.mediaKind,
      analysis: {
        captionBrief: detail.analysis.caption_brief,
        sceneDescription: detail.analysis.scene_description,
        primaryEmotion: detail.analysis.primary_emotion,
        conveys: detail.analysis.conveys,
        userIntent: detail.analysis.user_intent,
        rhetoricalRole: detail.analysis.rhetorical_role,
        textMediaRelationship: detail.analysis.text_media_relationship,
        culturalReference: detail.analysis.cultural_reference,
        analogyTarget: detail.analysis.analogy_target,
        searchKeywords: detail.analysis.search_keywords
      }
    };
  }

  const tweetId = request.tweetId;
  if (!tweetId) {
    throw new Error("Reply composition requires either usageId or tweetId");
  }

  const tweet = findTweetById(tweetId);
  if (!tweet) {
    throw new Error(`Tweet ${tweetId} was not found`);
  }

  return {
    usageId: null,
    tweetId: tweet.tweetId,
    tweetUrl: tweet.tweetUrl,
    authorUsername: tweet.authorUsername,
    createdAt: tweet.createdAt,
    tweetText: tweet.text,
    mediaKind: tweet.media[0]?.mediaKind ?? "none",
    analysis: {
      captionBrief: null,
      sceneDescription: null,
      primaryEmotion: null,
      conveys: null,
      userIntent: null,
      rhetoricalRole: null,
      textMediaRelationship: null,
      culturalReference: null,
      analogyTarget: null,
      searchKeywords: []
    }
  };
}

export async function composeReplyForUsage(
  request: ReplyCompositionRequest,
  options?: {
    onProgress?: (event: ReplyCompositionProgressEvent) => void;
  }
): Promise<ReplyCompositionResult> {
  options?.onProgress?.({
    stage: "starting",
    message: "Loading subject tweet context",
    detail: request.usageId ?? request.tweetId ?? null,
    goal: request.goal
  });
  const subject = await buildSubject(request);
  const model = createReplyComposerModel();
  const search = new CliFacetReplyMediaSearchProvider();

  options?.onProgress?.({
    stage: "planning",
    message: "Gemini is planning the reply angle and search terms",
    detail: subject.tweetText,
    goal: request.goal
  });
  const plan = await model.planReply({ request, subject });
  options?.onProgress?.({
    stage: "searching",
    message: "Searching local media candidates",
    detail: plan.searchQueries.join(" | "),
    goal: request.goal
  });
  const searchResult = await search.searchMany(plan.searchQueries);
  options?.onProgress?.({
    stage: "composing",
    message: "Gemini is choosing media and writing the final reply",
    detail: `${searchResult.candidates.length} candidates`,
    goal: request.goal
  });
  const draft = await model.composeReply({
    request,
    subject,
    plan,
    candidates: searchResult.candidates
  });

  const selectedMedia =
    searchResult.candidates.find((candidate) => candidate.candidateId === draft.selectedCandidateId) ?? null;
  const alternativeMedia = searchResult.candidates
    .filter((candidate) => candidate.candidateId !== draft.selectedCandidateId)
    .slice(0, 4);
  const wishlistEntries = plan.searchQueries.length > 0
    ? recordReplyMediaWishlist({
        usageId: request.usageId ?? null,
        goal: request.goal,
        queryLabels: plan.searchQueries,
        angle: plan.angle,
        tweetText: subject.tweetText
      })
    : [];

  if (wishlistEntries.length > 0) {
    options?.onProgress?.({
      stage: "completed",
      message: "Saved missing asset ideas to the wishlist",
      detail: wishlistEntries.map((entry) => entry.label).join(" | "),
      goal: request.goal
    });
  }

  const result = {
    provider: model.providerId,
    request,
    subject,
    plan,
    reply: {
      text: draft.replyText,
      whyThisReplyWorks: draft.whyThisReplyWorks,
      postingNotes: draft.postingNotes,
      mediaSelectionReason: draft.mediaSelectionReason
    },
    search: {
      provider: search.providerId,
      queries: plan.searchQueries,
      resultCount: searchResult.candidates.length,
      warning: searchResult.warning,
      wishlistSavedCount: wishlistEntries.length
    },
    selectedMedia,
    alternativeMedia
  };

  options?.onProgress?.({
    stage: "completed",
    message: "Reply draft complete",
    detail: selectedMedia ? "media selected" : "text-only draft",
    goal: request.goal
  });

  return result;
}

export async function composeRepliesForAllGoals(
  request: ReplyCompositionRequest,
  options?: {
    onProgress?: (event: ReplyCompositionProgressEvent) => void;
  }
): Promise<ReplyCompositionBatchResult> {
  const results = await composeAllGoals({
    goals: REPLY_COMPOSITION_GOALS,
    request,
    runSingle: composeReplyForUsage,
    onProgress: options?.onProgress
  });

  return {
    mode: "all_goals",
    usageId: request.usageId ?? null,
    tweetId: request.tweetId ?? null,
    results
  };
}
