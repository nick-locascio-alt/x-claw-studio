import Link from "next/link";
import { TopicClusters } from "@/src/components/topic-clusters";
import { TopicSearch } from "@/src/components/topic-search";
import { TopicTweetComposer } from "@/src/components/topic-tweet-composer";
import { getDashboardData } from "@/src/server/data";
import { getGroundedTopicNews, isGroundedTopicNewsEnabled } from "@/src/server/topic-grounded-news";

export default async function TopicsPage(props: {
  searchParams?: Promise<{
    composeTopicId?: string;
    autoCompose?: string;
    composeMode?: string;
    composeReplyTweetId?: string;
  }>;
}) {
  const data = getDashboardData();
  const searchParams = (await props.searchParams) ?? {};
  const groundedNewsByTopicId = await getGroundedTopicNews(data.topicClusters);
  const enrichedTopics = data.topicClusters.map((topic) => ({
    ...topic,
    groundedNews: groundedNewsByTopicId.get(topic.topicId) ?? null
  }));

  return (
    <main className="app-shell">
      <div className="bg-sun" />
      <div className="bg-grid-floor" />

      <section className="relative z-10 mb-8 terminal-window">
        <div className="window-bar">
          <div>
            <div className="section-kicker">Topic Explorer</div>
            <div className="type-cursor mt-2 font-[family:var(--font-label)] text-xs uppercase tracking-[0.22em] text-muted">
              &gt; Dedicated view for topic clusters, freshness, and posting angles
            </div>
          </div>
          <div className="window-dots">
            <span className="window-dot bg-orange" />
            <span className="window-dot bg-accent" />
            <span className="window-dot bg-cyan" />
          </div>
        </div>
        <div className="panel-body">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="section-title mt-1">All topic clusters</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                Use this view when the homepage slice is too small. It keeps the same hotness and grounded-news context, but shows the full topic set.
              </p>
            </div>
            <Link href="/" className="tt-link">
              <span>Back to dashboard</span>
            </Link>
          </div>
        </div>
      </section>

      <TopicTweetComposer
        topics={enrichedTopics}
        initialTopicId={searchParams.composeTopicId}
        initialComposeMode={searchParams.composeMode === "reply_to_example" ? "reply_to_example" : "new_post"}
        initialReplyTweetId={searchParams.composeReplyTweetId}
        autoComposeOnMount={searchParams.autoCompose === "1"}
      />

      <TopicClusters
        topics={enrichedTopics}
        groundedNewsEnabled={isGroundedTopicNewsEnabled()}
        limit={data.topicClusters.length}
        sectionLabel="Topic Explorer"
        sectionTitle="Inspect the full topic map"
        sectionDescription="Review specific cluster labels, scan examples, and decide which ideas deserve another tweet, a grounded-news expansion, or a full corpus search."
        draftTopicBasePath="/topics"
      />

      <TopicSearch />
    </main>
  );
}
