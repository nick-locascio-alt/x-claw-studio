"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ANALYSIS_FACET_NAMES, type AnalysisFacetName } from "@/src/lib/analysis-schema";
import { resolveMediaDisplayUrl } from "@/src/lib/media-display";
import type { HybridSearchResult } from "@/src/server/chroma-facets";

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
  metaphor: ["human vs machine", "signal vs noise", "speed as power", "light as information", "agency as company"],
  humor_mechanism: ["irony", "absurdity", "juxtaposition", "deadpan", "exaggeration"],
  cultural_reference: ["Silicon Valley", "Wall Street", "startup Twitter", "anime", "sci-fi"],
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

export function FacetSearch() {
  const [query, setQuery] = useState("");
  const [facetName, setFacetName] = useState("");
  const [presetValue, setPresetValue] = useState("");
  const [limit, setLimit] = useState("8");
  const [results, setResults] = useState<HybridSearchResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const presetTerms = getFacetPresets(facetName);

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

    setResults(body as HybridSearchResult);
  }
  const rows = results?.results ?? [];

  return (
    <section className="panel">
      <div className="sectionHeader">
        <div>
          <div className="sectionLabel">Facet Search</div>
          <h2 className="sectionTitle">Hybrid search across Chroma and lexical facets</h2>
        </div>
        <div className="chip chipAccent">{facetName || "all facets"}</div>
      </div>

      <div className="controlGrid">
        <div className="controlCard">
          <label className="formRow">
            <span>Query</span>
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
            />
          </label>
          <label className="formRow">
            <span>Facet Scope</span>
            <select
              value={facetName}
              onChange={(event) => {
                const nextFacetName = event.target.value as AnalysisFacetName | "";
                setFacetName(nextFacetName);
                setPresetValue("");
              }}
              className="selectInput"
            >
              <option value="">All facets (default)</option>
              {ANALYSIS_FACET_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="formRow">
            <span>Result Limit</span>
            <select
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              className="selectInput"
            >
              <option value="5">5</option>
              <option value="8">8</option>
              <option value="12">12</option>
              <option value="20">20</option>
            </select>
          </label>
          <label className="formRow">
            <span>Common Terms</span>
            <select
              value={presetValue}
              onChange={(event) => {
                const nextValue = event.target.value;
                setPresetValue(nextValue);
                if (nextValue) {
                  setQuery(nextValue);
                }
              }}
              className="selectInput"
            >
              <option value="">Choose a common term...</option>
              {presetTerms.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>
          </label>
          <div className="chipRow" style={{ marginBottom: 12 }}>
            {presetTerms.slice(0, 6).map((term) => (
              <button
                key={term}
                type="button"
                className="chipButton"
                onClick={() => {
                  setPresetValue(term);
                  setQuery(term);
                }}
              >
                {term}
              </button>
            ))}
          </div>
          <button
            className="actionButton"
            disabled={!query || isPending}
            onClick={() => startTransition(() => void runSearch())}
          >
            {isPending ? "Searching..." : "Search"}
          </button>
          {errorMessage ? <div className="errorText">{errorMessage}</div> : null}
        </div>

        <div className="controlCard">
          <div className="sectionLabel">Query Mode</div>
          <p className="helperText">
            Leave scope on `All facets (default)` to query across the full usage-analysis surface.
            Search now combines Chroma vector retrieval with a BM25-style lexical pass, then merges
            and de-dupes the hits by usage facet.
          </p>
          <p className="helperText">
            Use `Common Terms` for fast defaults, then edit the query freely. The dropdown changes
            based on the selected facet.
          </p>
          <div className="chipRow" style={{ marginTop: 10 }}>
            <span className="chip">vector + lexical</span>
            <span className="chip">default: all facets</span>
            <span className="chip">deduped merged ranking</span>
          </div>
        </div>
      </div>

      <div className="historyList" style={{ marginTop: 16 }}>
        {rows.length === 0 ? (
          <div className="placeholder">No search results yet.</div>
        ) : (
          rows.map((row) => {
            const displayUrl = resolveMediaDisplayUrl({
              localFilePath: row.media?.mediaLocalFilePath,
              posterUrl: row.media?.posterUrl,
              previewUrl: row.media?.previewUrl,
              sourceUrl: row.media?.sourceUrl
            });

            return (
              <article key={row.id} className="historyItem">
                {displayUrl ? (
                  <div className="searchResultMedia">
                    <img
                      src={displayUrl}
                      alt={row.media?.tweetText ?? String(row.metadata.usage_id ?? "search result media")}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                ) : null}
                <div className="historyTitleRow">
                  <strong className="mono">{String(row.metadata.facet_name ?? "facet")}</strong>
                  <div className="chipRow">
                    <span className="chip">score {row.combinedScore.toFixed(3)}</span>
                    <span className="chip">
                      vector {typeof row.vectorDistance === "number" ? row.vectorDistance.toFixed(4) : "n/a"}
                    </span>
                  </div>
                </div>
                <div className="helperText">
                  tweet {String(row.metadata.tweet_id ?? "unknown")} ·
                  usage {String(row.metadata.usage_id ?? "unknown")}
                </div>
                {row.media?.tweetText ? <p className="tweetText" style={{ marginTop: 10 }}>{row.media.tweetText}</p> : null}
                <div className="buttonRow" style={{ marginTop: 10 }}>
                  {row.metadata.usage_id ? (
                    <Link href={`/usage/${String(row.metadata.usage_id)}`} className="actionLink">
                      Open usage
                    </Link>
                  ) : null}
                  <span className="chip">{String(row.metadata.media_kind ?? "unknown media")}</span>
                  <span className="chip">via {row.matchedBy.join(" + ")}</span>
                  <span className="chip">lexical {row.lexicalScore.toFixed(3)}</span>
                  {row.media?.mediaAssetId ? <span className="chip mono">{row.media.mediaAssetId}</span> : null}
                </div>
                <pre className="logViewer" style={{ marginTop: 10 }}>{row.document}</pre>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
