import Link from "next/link";
import { listGeneratedDrafts } from "@/src/server/generated-drafts";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function DraftsPage() {
  const drafts = listGeneratedDrafts({ limit: 100 });

  return (
    <main className="app-shell">
      <div className="bg-sun" />
      <div className="bg-grid-floor" />

      <section className="relative z-10 mb-8 terminal-window">
        <div className="window-bar">
          <div>
            <div className="section-kicker">Drafts</div>
            <div className="type-cursor mt-2 font-[family:var(--font-label)] text-xs uppercase tracking-[0.22em] text-muted">
              &gt; Generated reply and tweet history
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
              <h1 className="section-title mt-1">Generated drafts</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                File-backed history for replies, topic posts, and media-led drafts. Running jobs appear here with their current stage.
              </p>
            </div>
            <Link href="/" className="tt-link">
              <span>Back to dashboard</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="relative z-10 mb-8 terminal-panel">
        <div className="panel-body">
          <div className="mb-5 flex flex-wrap gap-2">
            <span className="tt-chip tt-chip-accent">{drafts.filter((item) => item.status === "running").length} running</span>
            <span className="tt-chip">{drafts.filter((item) => item.status === "complete").length} complete</span>
            <span className="tt-chip">{drafts.filter((item) => item.status === "failed").length} failed</span>
            <span className="tt-chip">{drafts.length} tracked</span>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {drafts.map((draft) => (
              <article key={draft.draftId} className="terminal-window">
                <div className="window-bar">
                  <div className="section-kicker">{draft.kind}</div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`tt-chip ${draft.status === "running" ? "tt-chip-accent" : draft.status === "failed" ? "tt-chip-danger" : ""}`}>
                      {draft.status}
                    </span>
                    <span className="tt-chip">{formatDate(draft.updatedAt)}</span>
                  </div>
                </div>
                <div className="panel-body space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {draft.requestGoal ? <span className="tt-chip">{draft.requestGoal}</span> : null}
                    {draft.usageId ? <span className="tt-chip">{draft.usageId}</span> : null}
                    {draft.topicId ? <span className="tt-chip">{draft.topicId}</span> : null}
                    {draft.assetId ? <span className="tt-chip">{draft.assetId}</span> : null}
                  </div>

                  {draft.progressMessage ? (
                    <div className="tt-subpanel-soft">
                      <div className="tt-data-label">Current Status</div>
                      <p className="mt-2 text-sm leading-6 text-slate-200">{draft.progressMessage}</p>
                      {draft.progressDetail ? <p className="mt-2 text-xs uppercase tracking-[0.12em] text-cyan">{draft.progressDetail}</p> : null}
                    </div>
                  ) : null}

                  {draft.errorMessage ? (
                    <div className="tt-chip tt-chip-danger">{draft.errorMessage}</div>
                  ) : null}

                  {draft.outputs.length > 0 ? (
                    <div className="grid gap-3">
                      {draft.outputs.map((output, index) => (
                        <div key={`${draft.draftId}-${output.goal ?? "default"}-${index}`} className="tt-subpanel">
                          <div className="mb-2 flex flex-wrap gap-2">
                            {output.goal ? <span className="tt-chip">{output.goal}</span> : null}
                            {output.selectedMediaSourceType ? <span className="tt-chip">{output.selectedMediaSourceType}</span> : null}
                          </div>
                          <p className="text-sm leading-7 text-slate-100">{output.text}</p>
                          <p className="mt-3 text-sm leading-6 text-slate-300">{output.whyThisWorks}</p>
                          {output.mediaSelectionReason ? <p className="mt-2 text-sm leading-6 text-slate-300">{output.mediaSelectionReason}</p> : null}
                          {output.selectedMediaLabel ? <p className="mt-2 text-xs uppercase tracking-[0.12em] text-cyan">{output.selectedMediaLabel}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="tt-placeholder">No completed outputs yet.</div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
