import { TOPIC_POST_GOALS, type TopicPostBatchResult, type TopicPostProgressEvent, type TopicPostRequest, type TopicPostResult, type TopicPostSubject } from "@/src/lib/topic-composer";
import { getDashboardData } from "@/src/server/data";
import { CliFacetReplyMediaSearchProvider } from "@/src/server/reply-media-search";
import { createTopicComposerModel } from "@/src/server/topic-composer-model";
import { getGroundedTopicNews } from "@/src/server/topic-grounded-news";
import { composeAllGoals } from "@/src/server/composer-batch";
import { recordAssetWishlist } from "@/src/server/reply-media-wishlist";

async function buildTopicSubject(topicId: string): Promise<TopicPostSubject> {
  const data = getDashboardData();
  const topic = data.topicClusters.find((item) => item.topicId === topicId);
  if (!topic) {
    throw new Error(`Topic ${topicId} was not found`);
  }

  const groundedNews = (await getGroundedTopicNews([topic])).get(topic.topicId) ?? null;

  return {
    topicId: topic.topicId,
    label: topic.label,
    kind: topic.kind,
    hotnessScore: topic.hotnessScore,
    tweetCount: topic.tweetCount,
    recentTweetCount24h: topic.recentTweetCount24h,
    isStale: topic.isStale,
    mostRecentAt: topic.mostRecentAt,
    suggestedAngles: groundedNews?.suggestedAngles ?? topic.suggestedAngles,
    representativeTweets: topic.representativeTweets,
    groundedNews: groundedNews
      ? {
          summary: groundedNews.summary,
          whyNow: groundedNews.whyNow,
          sources: groundedNews.sources
        }
      : null
  };
}

export async function composeTweetFromTopic(
  request: TopicPostRequest,
  options?: {
    onProgress?: (event: TopicPostProgressEvent) => void;
  }
): Promise<TopicPostResult> {
  options?.onProgress?.({
    stage: "starting",
    message: "Loading topic context",
    detail: request.topicId
  });

  const subject = await buildTopicSubject(request.topicId);
  const model = createTopicComposerModel();
  const search = new CliFacetReplyMediaSearchProvider();

  options?.onProgress?.({
    stage: "planning",
    message: "Planning tweet angle and media search",
    detail: subject.label
  });
  const plan = await model.planPost({ request, subject });

  options?.onProgress?.({
    stage: "searching",
    message: "Searching local media candidates",
    detail: plan.searchQueries.join(" | ")
  });
  const searchResult = await search.searchMany(plan.searchQueries);

  options?.onProgress?.({
    stage: "composing",
    message: "Writing tweet and choosing media",
    detail: `${searchResult.candidates.length} candidates`
  });
  const draft = await model.composePost({
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
    ? recordAssetWishlist({
        usageId: null,
        goal: request.goal,
        source: "topic_composer",
        queryLabels: plan.searchQueries,
        angle: plan.angle,
        tweetText: subject.representativeTweets[0]?.text ?? null
      })
    : [];

  if (wishlistEntries.length > 0) {
    options?.onProgress?.({
      stage: "completed",
      message: "Saved missing asset ideas to the wishlist",
      detail: wishlistEntries.map((entry) => entry.label).join(" | ")
    });
  }

  options?.onProgress?.({
    stage: "completed",
    message: "Topic tweet draft complete",
    detail: selectedMedia ? "media selected" : "text-only draft"
  });

  return {
    provider: model.providerId,
    request,
    subject,
    plan,
    tweet: {
      text: draft.tweetText,
      whyThisTweetWorks: draft.whyThisTweetWorks,
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
}

export async function composeTweetsFromTopicForAllGoals(
  request: TopicPostRequest,
  options?: {
    onProgress?: (event: TopicPostProgressEvent) => void;
  }
): Promise<TopicPostBatchResult> {
  const results = await composeAllGoals({
    goals: TOPIC_POST_GOALS,
    request,
    runSingle: composeTweetFromTopic,
    onProgress: options?.onProgress
  });

  return {
    mode: "all_goals",
    topicId: request.topicId,
    results
  };
}
