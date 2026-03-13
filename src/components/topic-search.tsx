"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { TopicSearchResult } from "@/src/server/chroma-facets";

const DEFAULT_VISIBLE_COUNT = 8;
const TOPIC_QUERY_PRESETS = [
  "OpenAI pricing backlash",
  "Cloudflare crawl API",
  "agentic coding tools",
  "Meta acquisition joke",
  "AI chip race anxiety",
  "founder culture criticism"
];

export function TopicSearch() {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState("12");
  const [presetValue, setPresetValue] = useState("");
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_COUNT);
  const [results, setResults] = useState<TopicSearchResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const rows = results?.results ?? [];
  const clampedVisibleCount = rows.length === 0 ? 0 : Math.min(visibleCount, rows.length);
  const visibleRows = rows.slice(0, clampedVisibleCount);

  async function runSearch(): Promise<void> {
    setErrorMessage(null);
    const params = new URLSearchParams({ query, limit });
    const response = await fetch(`/api/search/topics?${params.toString()}`);
    const body = await response.json();

    if (!response.ok) {
      setErrorMessage(body.error || "Search failed");
      return;
    }

    const nextResults = body as TopicSearchResult;
    setResults(nextResults);
    setVisibleCount(
      Math.min(nextResults.results.length, Math.max(DEFAULT_VISIBLE_COUNT, Math.min(Number(limit), nextResults.results.length)))
    );
  }

  return (
    <section className="relative z-10 mb-8 terminal-panel">
      <div className="panel-body">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="section-kicker">Topic Search</div>
            <h2 className="section-title mt-3">Search by topic, framing, and opinion</h2>
          </div>
          <div className="tt-chip tt-chip-accent">topic_tweet index</div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="terminal-window">
            <div className="window-bar">
              <div className="section-kicker">Query Console</div>
              <div className="window-dots">
                <span className="window-dot bg-orange" />
                <span className="window-dot bg-accent" />
                <span className="window-dot bg-cyan" />
              </div>
            </div>
            <div className="panel-body space-y-4">
              <label className="tt-field">
                <span className="tt-field-label">Query</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && query && !isPending) {
                      startTransition(() => void runSearch());
                    }
                  }}
                  type="text"
                  placeholder="critical tone about OpenAI pricing, celebratory Meta acquisition joke..."
                  className="tt-input"
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="tt-field">
                  <span className="tt-field-label">Result Limit</span>
                  <select value={limit} onChange={(event) => setLimit(event.target.value)} className="tt-select">
                    <option value="6">6</option>
                    <option value="12">12</option>
                    <option value="24">24</option>
                    <option value="40">40</option>
                  </select>
                </label>
                <label className="tt-field">
                  <span className="tt-field-label">Preset Queries</span>
                  <select
                    value={presetValue}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setPresetValue(nextValue);
                      if (nextValue) {
                        setQuery(nextValue);
                      }
                    }}
                    className="tt-select"
                  >
                    <option value="">Choose a common topic search...</option>
                    {TOPIC_QUERY_PRESETS.map((term) => (
                      <option key={term} value={term}>
                        {term}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {TOPIC_QUERY_PRESETS.slice(0, 4).map((term) => (
                  <button
                    key={term}
                    type="button"
                    className="tt-chip transition-all duration-150 ease-linear hover:border-cyan hover:text-cyan hover:shadow-[0_0_3px_#00d4ff,0_0_12px_rgba(0,212,255,0.14)]"
                    onClick={() => {
                      setPresetValue(term);
                      setQuery(term);
                    }}
                  >
                    {term}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="tt-button"
                  disabled={!query || isPending}
                  onClick={() => startTransition(() => void runSearch())}
                >
                  <span>{isPending ? "Searching..." : "Search Topics"}</span>
                </button>
                {errorMessage ? <div className="tt-chip tt-chip-danger">{errorMessage}</div> : null}
              </div>
            </div>
          </div>

          <div className="terminal-window">
            <div className="window-bar">
              <div className="section-kicker">Search Shape</div>
              <div className="tt-chip">vector + lexical fallback</div>
            </div>
            <div className="panel-body space-y-4">
              <div className="tt-subpanel">
                <p className="tt-copy">
                  This search is broader than a label match. It indexes the topic label, the tweet text, the opinion fields, and the linked usage facets.
                </p>
              </div>
              <div className="tt-subpanel">
                <p className="tt-copy">
                  Use it when you want to find topics that a media asset can support, or when you care about the surrounding tone rather than the noun alone.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="tt-chip">sentiment</span>
                <span className="tt-chip">stance</span>
                <span className="tt-chip">tone</span>
                <span className="tt-chip">why-now</span>
                <span className="tt-chip">usage facets</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {rows.length === 0 ? (
            <div className="terminal-window">
              <div className="panel-body">
                <div className="tt-placeholder">No topic results yet.</div>
              </div>
            </div>
          ) : (
            <>
              <div className="terminal-window">
                <div className="panel-body">
                  <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="tt-subpanel-soft">
                      <div className="tt-data-label">Result Window</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="tt-chip tt-chip-accent">{rows.length} fetched</span>
                        <span className="tt-chip">{visibleRows.length} visible</span>
                        <span className="tt-chip">{results?.query ?? query}</span>
                      </div>
                    </div>
                    <label className="tt-field">
                      <span className="tt-field-label">Show Results: {clampedVisibleCount}</span>
                      <input
                        type="range"
                        min="1"
                        max={rows.length}
                        step="1"
                        value={clampedVisibleCount}
                        onChange={(event) => setVisibleCount(Number(event.target.value))}
                        className="accent-cyan"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {visibleRows.map((row) => (
                  <article key={row.id} className="terminal-window">
                    <div className="panel-body space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <strong className="font-[family:var(--font-label)] text-xs uppercase tracking-[0.24em] text-accent">
                          {row.topic.label ?? row.analysis.summaryLabel ?? "Untitled topic"}
                        </strong>
                        <div className="flex flex-wrap gap-2">
                          <span className="tt-chip">score {row.combinedScore.toFixed(3)}</span>
                          <span className="tt-chip">hotness {row.topic.hotnessScore.toFixed(1)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="tt-chip">{row.analysis.stance}</span>
                        <span className="tt-chip">{row.analysis.sentiment}</span>
                        <span className="tt-chip">{row.analysis.opinionIntensity} intensity</span>
                        {row.analysis.emotionalTone ? <span className="tt-chip">tone {row.analysis.emotionalTone}</span> : null}
                        {row.analysis.targetEntity ? <span className="tt-chip">target {row.analysis.targetEntity}</span> : null}
                        {row.topic.isStale ? <span className="tt-chip">stale</span> : null}
                      </div>
                      {row.analysis.whyNow ? <p className="text-sm leading-7 text-slate-200">{row.analysis.whyNow}</p> : null}
                      <p className="text-sm leading-7 text-slate-300">{row.tweet.text ?? "No tweet text"}</p>
                      <div className="flex flex-wrap gap-2">
                        {row.analysis.signals.slice(0, 4).map((signal) => (
                          <span key={`${row.id}-${signal}`} className="tt-chip">
                            {signal}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="tt-chip">via {row.matchedBy.join(" + ")}</span>
                        <span className="tt-chip">{row.topic.tweetCount} tweets</span>
                        <span className="tt-chip">lexical {row.lexicalScore.toFixed(3)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {row.usageIds[0] ? (
                          <Link href={`/usage/${row.usageIds[0]}`} className="tt-link">
                            <span>Open usage</span>
                          </Link>
                        ) : null}
                        <Link href="/topics" className="tt-link">
                          <span>Stay in topics</span>
                        </Link>
                      </div>
                      <pre className="tt-log">{row.document}</pre>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
