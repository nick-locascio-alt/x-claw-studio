"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ANALYSIS_FACET_NAMES, type AnalysisFacetName } from "@/src/lib/analysis-schema";
import { resolveMediaDisplayUrl } from "@/src/lib/media-display";
import { MediaPreview } from "@/src/components/media-preview";
import type { HybridSearchResult } from "@/src/server/chroma-facets";

const DEFAULT_VISIBLE_GRID_COUNT = 12;

const COMMON_FACET_PRESETS: Record<string, string[]> = {
  all: [
    "reaction image",
    "anxiety",
    "bullish chart",
    "terminal screenshot",
    "product UI",
    "celebrity",
    "text overlay",
    "watermark",
    "silicon photonics",
    "meme format"
  ],
  primary_emotion: ["anxiety", "awe", "confidence", "humor", "curiosity", "urgency", "dread", "calm"],
  emotional_tone: ["tense", "playful", "aspirational", "analytical", "sarcastic", "urgent", "confident", "chaotic"],
  conveys: ["competence", "urgency", "status", "optimism", "panic", "humor", "novelty", "technical authority"],
  user_intent: ["educate", "persuade", "show progress", "signal taste", "sell product", "provoke reaction"],
  rhetorical_role: ["reaction", "evidence", "explainer", "demo", "announcement", "flex", "meme"],
  text_media_relationship: ["reinforces text", "contrasts text", "visual proof", "reframes claim", "literal illustration"],
  video_music: ["dramatic score", "upbeat music", "no music", "ambient soundtrack", "unclear audio"],
  video_sound: ["dialogue", "ambient room noise", "crowd noise", "sound effects", "silence"],
  video_action: ["talking to camera", "screen recording walkthrough", "fast cuts", "crowd reaction", "product demo motion"],
  metaphor: ["human vs machine", "signal vs noise", "speed as power", "light as information", "agency as company"],
  humor_mechanism: ["irony", "absurdity", "juxtaposition", "deadpan", "exaggeration"],
  cultural_reference: ["Silicon Valley", "Wall Street", "startup Twitter", "anime", "sci-fi"],
  reference_entity: ["Jian-Yang", "Elon Musk", "Paul Atreides", "Wojak", "Drake"],
  reference_source: ["Silicon Valley", "Dune", "Twitter/X", "The Matrix", "anime"],
  reference_plot_context: ["copycat startup", "IP theft", "founder meltdown", "chosen one arc", "corporate rivalry"],
  analogy_target: ["AI model distillation", "copycat startup", "US-China AI rivalry", "founder culture", "tech bootlegging"],
  analogy_scope: ["personal", "company", "market", "geopolitical", "company, geopolitical"],
  meme_format: ["reaction image", "screenshot meme", "quote card", "chart meme", "before and after"],
  persuasion_strategy: ["authority", "social proof", "fear", "aspiration", "novelty", "clarity"],
  trend_signal: ["AI agents", "crypto", "founder brand", "productivity", "deep tech", "design tools"],
  reuse_pattern: ["reaction reuse", "screenshot repost", "template graphic", "founder flex asset", "chart reuse"],
  why_it_works: ["instantly legible", "status signaling", "high novelty", "strong contrast", "dense proof"],
  audience_takeaway: ["this is real", "this is urgent", "this is impressive", "this is easy", "this is the future"],
  search_keywords: ["chart", "dashboard", "terminal", "agent", "meme", "founder", "AI", "reaction"],
  has_celebrity: ["true", "false"],
  has_human_face: ["true", "false"],
  features_female: ["true", "false"],
  features_male: ["true", "false"],
  has_screenshot_ui: ["true", "false"],
  has_text_overlay: ["true", "false"],
  has_chart_or_graph: ["true", "false"],
  has_logo_or_watermark: ["true", "false"]
};

function getFacetPresets(facetName: string): string[] {
  if (!facetName) {
    return COMMON_FACET_PRESETS.all;
  }

  return COMMON_FACET_PRESETS[facetName] ?? COMMON_FACET_PRESETS.all;
}

function getGridClassName(gridColumns: number): string {
  if (gridColumns <= 1) {
    return "grid gap-4 grid-cols-1";
  }

  if (gridColumns === 2) {
    return "grid gap-4 grid-cols-1 md:grid-cols-2";
  }

  if (gridColumns === 3) {
    return "grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3";
  }

  return "grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4";
}

export function FacetSearch() {
  const [query, setQuery] = useState("");
  const [facetName, setFacetName] = useState("");
  const [presetValue, setPresetValue] = useState("");
  const [limit, setLimit] = useState("20");
  const [gridColumns, setGridColumns] = useState(3);
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_GRID_COUNT);
  const [results, setResults] = useState<HybridSearchResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const presetTerms = getFacetPresets(facetName);
  const rows = results?.results ?? [];
  const clampedVisibleCount = rows.length === 0 ? 0 : Math.min(visibleCount, rows.length);
  const visibleRows = rows.slice(0, clampedVisibleCount);

  async function runSearch(): Promise<void> {
    setErrorMessage(null);
    const params = new URLSearchParams({ query, limit });
    if (facetName) {
      params.set("facetName", facetName);
    }

    const response = await fetch(`/api/search/facets?${params.toString()}`);
    const body = await response.json();

    if (!response.ok) {
      setErrorMessage(body.error || "Search failed");
      return;
    }

    const nextResults = body as HybridSearchResult;
    setResults(nextResults);
    setVisibleCount(
      Math.min(
        nextResults.results.length,
        Math.max(DEFAULT_VISIBLE_GRID_COUNT, Math.min(Number(limit), nextResults.results.length))
      )
    );
  }

  return (
    <section className="relative z-10 mb-8 terminal-panel">
      <div className="panel-body">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="section-kicker">Facet Search</div>
            <h2 className="section-title mt-3">Hybrid search across Chroma and lexical facets</h2>
          </div>
          <div className="tt-chip tt-chip-accent">{facetName || "all facets"}</div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
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
                  placeholder="reaction image for market panic, sarcastic win screen, bullish chart meme..."
                  className="tt-input"
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="tt-field">
                  <span className="tt-field-label">Facet Scope</span>
                  <select
                    value={facetName}
                    onChange={(event) => {
                      const nextFacetName = event.target.value as AnalysisFacetName | "";
                      setFacetName(nextFacetName);
                      setPresetValue("");
                    }}
                    className="tt-select"
                  >
                    <option value="">All facets (default)</option>
                    {ANALYSIS_FACET_NAMES.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="tt-field">
                  <span className="tt-field-label">Result Limit</span>
                  <select value={limit} onChange={(event) => setLimit(event.target.value)} className="tt-select">
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="40">40</option>
                    <option value="60">60</option>
                    <option value="100">100</option>
                  </select>
                </label>
              </div>
              <label className="tt-field">
                <span className="tt-field-label">Common Terms</span>
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
                  <option value="">Choose a common term...</option>
                  {presetTerms.map((term) => (
                    <option key={term} value={term}>
                      {term}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                {presetTerms.slice(0, 6).map((term) => (
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
                  <span>{isPending ? "Searching..." : "Search"}</span>
                </button>
                {errorMessage ? <div className="tt-chip tt-chip-danger">{errorMessage}</div> : null}
              </div>
            </div>
          </div>

          <div className="terminal-window">
            <div className="window-bar">
              <div className="section-kicker">Query Mode</div>
              <div className="tt-chip">vector + lexical</div>
            </div>
            <div className="panel-body space-y-4">
              <div className="tt-subpanel">
                <p className="tt-copy">
                Leave scope on `All facets (default)` to query across the full usage-analysis surface. Search merges Chroma vector retrieval with a lexical pass, then de-dupes the hits by usage facet.
                </p>
              </div>
              <div className="tt-subpanel">
                <p className="tt-copy">
                Use `Common Terms` for a fast starting point, then overwrite the query freely. The preset bank changes with the selected facet.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="tt-chip">default: all facets</span>
                <span className="tt-chip">merged ranking</span>
                <span className="tt-chip">deduped results</span>
                <span className="tt-chip">default limit: 20</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {rows.length === 0 ? (
            <div className="terminal-window">
              <div className="panel-body">
                <div className="tt-placeholder">No search results yet.</div>
              </div>
            </div>
          ) : (
            <>
              <div className="terminal-window">
                <div className="panel-body">
                  <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr_0.7fr]">
                    <div className="tt-subpanel-soft">
                      <div className="tt-data-label">Result Window</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="tt-chip tt-chip-accent">{rows.length} fetched</span>
                        <span className="tt-chip">{visibleRows.length} visible</span>
                        <span className="tt-chip">{results?.query ?? query}</span>
                      </div>
                    </div>
                    <label className="tt-field">
                      <span className="tt-field-label">Cards Per Row: {gridColumns}</span>
                      <input
                        type="range"
                        min="1"
                        max="4"
                        step="1"
                        value={gridColumns}
                        onChange={(event) => setGridColumns(Number(event.target.value))}
                        className="accent-cyan"
                      />
                    </label>
                    <label className="tt-field">
                      <span className="tt-field-label">Show In Grid: {clampedVisibleCount}</span>
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

              <div className={getGridClassName(gridColumns)}>
                {visibleRows.map((row) => {
                  const displayUrl = resolveMediaDisplayUrl({
                    localFilePath: row.media?.mediaLocalFilePath,
                    posterUrl: row.media?.posterUrl,
                    previewUrl: row.media?.previewUrl,
                    sourceUrl: row.media?.sourceUrl
                  });

                  return (
                    <article key={row.id} className="terminal-window">
                      <div className="panel-body space-y-4">
                        {displayUrl ? (
                          <div className="tt-media-frame aspect-video">
                            <MediaPreview
                              alt={row.media?.tweetText ?? String(row.metadata.usage_id ?? "search result media")}
                              imageUrl={displayUrl}
                              videoFilePath={row.media?.mediaPlayableFilePath}
                            />
                          </div>
                        ) : null}
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <strong className="font-[family:var(--font-label)] text-xs uppercase tracking-[0.24em] text-accent">
                            {String(row.metadata.facet_name ?? "facet")}
                          </strong>
                          <div className="flex flex-wrap gap-2">
                            <span className="tt-chip">score {row.combinedScore.toFixed(3)}</span>
                            <span className="tt-chip">
                              vector {typeof row.vectorDistance === "number" ? row.vectorDistance.toFixed(4) : "n/a"}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-slate-300">
                          tweet {String(row.metadata.tweet_id ?? "unknown")} · usage {String(row.metadata.usage_id ?? "unknown")}
                        </div>
                        {row.media?.tweetText ? <p className="text-sm leading-7 text-slate-200">{row.media.tweetText}</p> : null}
                        <div className="flex flex-wrap gap-2">
                          {row.metadata.usage_id ? (
                            <Link href={`/usage/${String(row.metadata.usage_id)}`} className="tt-link">
                              <span>Open usage</span>
                            </Link>
                          ) : null}
                          <span className="tt-chip">{String(row.metadata.media_kind ?? "unknown media")}</span>
                          <span className="tt-chip">via {row.matchedBy.join(" + ")}</span>
                          <span className="tt-chip">lexical {row.lexicalScore.toFixed(3)}</span>
                          {row.media?.mediaAssetId ? <span className="tt-chip">{row.media.mediaAssetId}</span> : null}
                        </div>
                        <pre className="tt-log">{row.document}</pre>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
