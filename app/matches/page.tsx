import Link from "next/link";
import { UsageQueue } from "@/src/components/usage-queue";
import { getDashboardData } from "@/src/server/data";

export default function MatchesPage() {
  const data = getDashboardData();

  return (
    <main className="app-shell">
      <div className="bg-sun" />
      <div className="bg-grid-floor" />

      <section className="relative z-10 mb-8 terminal-window">
        <div className="window-bar">
          <div>
            <div className="section-kicker">Match Explorer</div>
            <div className="type-cursor mt-2 font-[family:var(--font-label)] text-xs uppercase tracking-[0.22em] text-muted">
              &gt; Exact and similar media clusters
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
              <h1 className="section-title mt-1">Related media clusters</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                This view reuses the main usage queue, filtered to items with exact or similar matches and collapsed by default.
              </p>
            </div>
            <Link href="/" className="tt-link">
              <span>Back to dashboard</span>
            </Link>
          </div>
        </div>
      </section>

      <UsageQueue
        usages={data.tweetUsages}
        initialMatchFilter="matched"
        sectionLabel="Match Explorer"
        sectionTitle="Exact and similar media with shared controls"
        compact
        initialHideDuplicateAssets
      />
    </main>
  );
}
