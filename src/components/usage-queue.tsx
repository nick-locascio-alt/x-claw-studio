"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { TweetUsageRecord } from "@/src/lib/types";
import { AnalyzeUsageButton } from "@/src/components/analyze-usage-button";
import { AssetStarButton } from "@/src/components/asset-star-button";
import { resolveMediaDisplayUrl } from "@/src/lib/media-display";

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function renderField(value: string | null): string {
  return value ?? "Pending";
}

export function UsageQueue(props: { usages: TweetUsageRecord[] }) {
  const [matchFilter, setMatchFilter] = useState<"all" | "phash" | "starred">("all");
  const [viewMode, setViewMode] = useState<"summary" | "detail">("detail");
  const [columnsPerRow, setColumnsPerRow] = useState(4);
  const [expandedUsageIds, setExpandedUsageIds] = useState<string[]>([]);

  const visibleUsages = useMemo(() => {
    return props.usages.filter((usage) => {
      if (matchFilter === "phash") {
        return usage.phashMatchCount > 0;
      }

      if (matchFilter === "starred") {
        return usage.mediaAssetStarred;
      }

      return true;
    });
  }, [matchFilter, props.usages]);

  function isExpanded(usageId: string): boolean {
    return expandedUsageIds.includes(usageId);
  }

  function toggleExpanded(usageId: string): void {
    setExpandedUsageIds((current) =>
      current.includes(usageId) ? current.filter((id) => id !== usageId) : [...current, usageId]
    );
  }

  function expandAll(): void {
    setExpandedUsageIds(visibleUsages.map((usage) => usage.usageId));
  }

  function collapseAll(): void {
    setExpandedUsageIds([]);
  }

  return (
    <div className="panel">
      <div className="sectionHeader">
        <div>
          <div className="sectionLabel">Usage Queue</div>
          <h2 className="sectionTitle">Media usages with analysis and pHash context</h2>
        </div>
        <div className="chip chipAccent">{visibleUsages.length} visible</div>
      </div>

      <div className="toolbarRow" style={{ marginBottom: 16 }}>
        <label className="formRow" style={{ margin: 0 }}>
          <span>Filter</span>
          <select
            className="selectInput"
            value={matchFilter}
            onChange={(event) => setMatchFilter(event.target.value as "all" | "phash" | "starred")}
          >
            <option value="all">All posts</option>
            <option value="phash">Only pHash matches</option>
            <option value="starred">Only starred assets</option>
          </select>
        </label>

        <label className="formRow" style={{ margin: 0 }}>
          <span>View</span>
          <select
            className="selectInput"
            value={viewMode}
            onChange={(event) => setViewMode(event.target.value as "summary" | "detail")}
          >
            <option value="detail">Detail</option>
            <option value="summary">Summary</option>
          </select>
        </label>
        <label className="formRow" style={{ margin: 0, minWidth: 180 }}>
          <span>Per Row: {columnsPerRow}</span>
          <input
            type="range"
            min="1"
            max="6"
            step="1"
            value={columnsPerRow}
            onChange={(event) => setColumnsPerRow(Number(event.target.value))}
          />
        </label>
        <div className="buttonRow">
          <button type="button" className="actionLink" onClick={expandAll}>
            Expand all
          </button>
          <button type="button" className="actionLink" onClick={collapseAll}>
            Collapse all
          </button>
        </div>
      </div>

      <div
        className="usageList"
        style={{ ["--usage-columns" as string]: String(columnsPerRow) }}
      >
        {visibleUsages.map(({ usageId, tweet, mediaIndex, analysis, phashMatchCount, mediaAssetUsageCount, mediaLocalFilePath, mediaAssetId, mediaAssetStarred }) => {
          const media = tweet.media[mediaIndex];
          const displayUrl = resolveMediaDisplayUrl({
            localFilePath: mediaLocalFilePath,
            posterUrl: media.posterUrl,
            previewUrl: media.previewUrl,
            sourceUrl: media.sourceUrl
          });

          return (
            <article key={usageId} className="usageCard">
              <div className="usageMedia">
                {displayUrl ? (
                  <img
                    src={displayUrl}
                    alt={tweet.text ?? "tweet media"}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "grid",
                      placeItems: "center",
                      color: "#d8c5b0"
                    }}
                  >
                    no preview
                  </div>
                )}
              </div>
              <div className="usageBody">
                <div className="buttonRow" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div className="chipRow">
                    <span className="chip">{tweet.authorUsername}</span>
                    <span className="chip">{media.mediaKind}</span>
                    <span className="chip">{formatDate(tweet.createdAt)}</span>
                    <span className={`chip ${mediaAssetStarred ? "chipAccent" : ""}`}>
                      {mediaAssetStarred ? "starred" : "not starred"}
                    </span>
                  </div>
                  <button type="button" className="actionLink" onClick={() => toggleExpanded(usageId)}>
                    {isExpanded(usageId) ? "Hide details" : "Show details"}
                  </button>
                </div>
                <div className="buttonRow usageActionRow" style={{ marginTop: 10, marginBottom: 10 }}>
                  <Link
                    href={`/usage/${usageId}`}
                    className="actionLink compactAction"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Full detail ↗
                  </Link>
                  {mediaAssetId ? (
                    <AssetStarButton
                      assetId={mediaAssetId}
                      starred={mediaAssetStarred}
                      className="actionLink compactAction"
                    />
                  ) : null}
                </div>

                {isExpanded(usageId) ? (
                  <div className="usageAccordion">
                    <p className="tweetText">{tweet.text}</p>
                    <div className="chipRow" style={{ marginBottom: 12 }}>
                      <span className="chip">likes {tweet.metrics.likes ?? "-"}</span>
                      <span className="chip">reposts {tweet.metrics.reposts ?? "-"}</span>
                      <span className="chip">views {tweet.metrics.views ?? "-"}</span>
                      <span className="chip">{analysis.status}</span>
                      <span className={`chip ${phashMatchCount > 0 ? "chipAccent" : ""}`}>
                        pHash matches {phashMatchCount}
                      </span>
                      <span className="chip">asset usages {mediaAssetUsageCount}</span>
                    </div>
                    <AnalyzeUsageButton
                      tweetId={tweet.tweetId}
                      mediaIndex={mediaIndex}
                      className="actionButton compactPrimaryAction"
                    />

                    {viewMode === "detail" ? (
                      <div className="fieldGrid">
                        <div className="fieldCard">
                          <strong>Conveys</strong>
                          <span className={!analysis.conveys ? "placeholder" : undefined}>{renderField(analysis.conveys)}</span>
                        </div>
                        <div className="fieldCard">
                          <strong>User Intent</strong>
                          <span className={!analysis.user_intent ? "placeholder" : undefined}>
                            {renderField(analysis.user_intent)}
                          </span>
                        </div>
                        <div className="fieldCard">
                          <strong>Rhetorical Role</strong>
                          <span className={!analysis.rhetorical_role ? "placeholder" : undefined}>
                            {renderField(analysis.rhetorical_role)}
                          </span>
                        </div>
                        <div className="fieldCard">
                          <strong>Metaphor</strong>
                          <span className={!analysis.metaphor ? "placeholder" : undefined}>
                            {renderField(analysis.metaphor)}
                          </span>
                        </div>
                        <div className="fieldCard">
                          <strong>Text Media Relationship</strong>
                          <span className={!analysis.text_media_relationship ? "placeholder" : undefined}>
                            {renderField(analysis.text_media_relationship)}
                          </span>
                        </div>
                        <div className="fieldCard">
                          <strong>Why It Works</strong>
                          <span className={!analysis.why_it_works ? "placeholder" : undefined}>
                            {renderField(analysis.why_it_works)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="helperText">
                        {analysis.caption_brief ?? analysis.scene_description ?? "Open detail view for full analysis and pHash match context."}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
