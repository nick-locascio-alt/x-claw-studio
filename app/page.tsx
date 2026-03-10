import { getDashboardData } from "@/src/server/data";
import Link from "next/link";
import { ControlPanel } from "@/src/components/control-panel";
import { FacetSearch } from "@/src/components/facet-search";
import { UsageQueue } from "@/src/components/usage-queue";

export default function HomePage() {
  const data = getDashboardData();
  const latestManifest = data.manifests[0] ?? null;
  const phashMatchedUsageCount = data.tweetUsages.filter((usage) => usage.phashMatchCount > 0).length;

  return (
    <main className="shell">
      <section className="masthead">
        <div>
          <div className="sectionLabel">Twitter Trend Lab</div>
          <div className="mastheadTitle">Editorial ops desk for captured X media.</div>
        </div>
        <div className="mastheadActions">
          <Link href="/phash" className="actionLink">
            Open pHash grid
          </Link>
        </div>
      </section>

      <section className="hero">
        <div className="heroCard">
          <div className="eyebrow">Local-first intelligence surface</div>
          <h1 className="headline">Capture the feed. Triage the signal. Inspect what deserves analysis.</h1>
          <p className="lede">
            Wired directly to your local crawl outputs, this workspace turns raw timelines into an
            operations view: what was captured, what is visually repeating, what is still pending,
            and which assets are worth promoting into deeper semantic analysis.
          </p>
          <div className="heroBand">
            <div className="heroBandStat">
              <span className="heroBandLabel">Queue Health</span>
              <strong>{data.tweetUsages.length - data.tweetUsages.filter((usage) => usage.analysis.status === "complete").length} pending analysis</strong>
            </div>
            <div className="heroBandStat">
              <span className="heroBandLabel">Latest Run</span>
              <strong className="mono">{latestManifest?.runId ?? "none"}</strong>
            </div>
          </div>
        </div>
        <div className="heroGrid">
          <div className="metricCard">
            <div className="metricLabel">Tweets Indexed</div>
            <div className="metricValue">{data.totalTweetCount}</div>
          </div>
          <div className="metricCard">
            <div className="metricLabel">Media Usages</div>
            <div className="metricValue">{data.tweetUsages.length}</div>
          </div>
          <div className="metricCard">
            <div className="metricLabel">Crawl Runs</div>
            <div className="metricValue">{data.manifests.length}</div>
          </div>
          <div className="metricCard">
            <div className="metricLabel">pHash-Matched Usages</div>
            <div className="metricValue">{phashMatchedUsageCount}</div>
            <div className="metricMeta">Repeated visuals surfaced for cluster review.</div>
          </div>
          <div className="metricCard">
            <div className="metricLabel">Latest Crawl Run</div>
            <div className="metricValue mono">{latestManifest?.runId ?? "none"}</div>
            <div className="metricMeta">Most recent manifest available in local storage.</div>
          </div>
        </div>
      </section>

      <section className="pipelineSection">
        <div className="sectionHeader">
          <div>
            <div className="sectionLabel">Pipeline View</div>
            <h2 className="sectionTitle">Three stages, one desk</h2>
          </div>
        </div>
        <div className="stageList">
          <div className="stageCard">
            <div className="stageLabel">Stage 1</div>
            <h3>Capture</h3>
            <p>
              Preserve tweet HTML, text, metrics, author context, media URLs, and poster images.
            </p>
          </div>
          <div className="stageCard">
            <div className="stageLabel">Stage 2</div>
            <h3>Promotion</h3>
            <p>
              Keep video lightweight until an asset is trending enough to merit full download.
            </p>
          </div>
          <div className="stageCard">
            <div className="stageLabel">Stage 3</div>
            <h3>Analysis</h3>
            <p>
              Fill `conveys`, `userIntent`, `rhetoricalRole`, `metaphor`, and other retrieval fields.
            </p>
          </div>
        </div>
      </section>

      <FacetSearch />

      <ControlPanel
        schedulerConfig={data.schedulerConfig}
        runHistory={data.runHistory}
      />

      <UsageQueue usages={data.tweetUsages} />

      <section className="panel">
        <div className="sectionHeader">
          <div>
            <div className="sectionLabel">Crawl Runs</div>
            <h2 className="sectionTitle">Raw timeline manifests</h2>
          </div>
        </div>
        <div className="manifestList">
          {data.manifests.length === 0 ? (
            <article className="manifestCard">
              <div className="placeholder">
                No live crawl manifests yet. Run `npm run crawl:openclaw`.
              </div>
            </article>
          ) : (
            data.manifests.map((manifest) => (
              <article key={manifest.runId} className="manifestCard">
                <div className="sectionLabel">Run</div>
                <h3 className="mono" style={{ margin: "8px 0 10px" }}>
                  {manifest.runId}
                </h3>
                <div className="chipRow">
                  <span className="chip">{manifest.capturedTweets.length} tweets</span>
                  <span className="chip">
                    {manifest.interceptedMedia.length} intercepted assets
                  </span>
                  <span className="chip">
                    videos {manifest.downloadVideos ? "enabled" : "deferred"}
                  </span>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
