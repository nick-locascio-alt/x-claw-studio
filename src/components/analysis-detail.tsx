import Link from "next/link";
import { AssetStarButton } from "@/src/components/asset-star-button";
import { resolveMediaDisplayUrl } from "@/src/lib/media-display";
import type { MediaAssetView, UsageAnalysis } from "@/src/lib/types";

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function renderValue(value: UsageAnalysis[keyof UsageAnalysis]) {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "Pending";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (value === null) {
    return "Pending";
  }

  return String(value);
}

function uniqueUrls(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function AnalysisDetail(props: {
  usageId: string;
  tweet: {
    tweetUrl: string | null;
    text: string | null;
    authorUsername: string | null;
    createdAt: string | null;
  };
  media: {
    sourceUrl: string | null;
    posterUrl: string | null;
    previewUrl: string | null;
    mediaKind: string;
  };
  orderedFacets: Array<{ name: string; value: UsageAnalysis[keyof UsageAnalysis] }>;
  mediaAssetView: MediaAssetView | null;
}) {
  const usageUrls = uniqueUrls([props.media.sourceUrl, props.media.posterUrl, props.media.previewUrl]);
  const assetSourceUrls = props.mediaAssetView?.asset.sourceUrls ?? [];
  const assetPreviewUrls = props.mediaAssetView?.asset.previewUrls ?? [];
  const assetPosterUrls = props.mediaAssetView?.asset.posterUrls ?? [];
  const allAssetUrls = uniqueUrls([...assetSourceUrls, ...assetPreviewUrls, ...assetPosterUrls]);
  const localAssetFiles = uniqueUrls([props.mediaAssetView?.asset.canonicalFilePath ?? null]);
  const heroMediaUrl = resolveMediaDisplayUrl({
    localFilePath: props.mediaAssetView?.asset.canonicalFilePath ?? null,
    posterUrl: props.media.posterUrl,
    previewUrl: props.media.previewUrl,
    sourceUrl: props.media.sourceUrl
  });

  return (
    <main className="shell">
      <section className="panel">
        <div className="sectionHeader">
          <div>
            <div className="sectionLabel">Usage Detail</div>
            <h1 className="sectionTitle mono">{props.usageId}</h1>
          </div>
          <Link href="/" className="actionLink">
            Back
          </Link>
        </div>

        <div className="detailHero">
          <div className="detailMedia">
            {heroMediaUrl ? (
              <img
                src={heroMediaUrl}
                alt={props.tweet.text ?? "tweet media"}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div className="placeholder">no preview</div>
            )}
          </div>
          <div className="detailMeta">
            <div className="chipRow">
              <span className="chip">{props.tweet.authorUsername ?? "unknown author"}</span>
              <span className="chip">{props.media.mediaKind}</span>
              <span className="chip">{formatDate(props.tweet.createdAt)}</span>
            </div>
            <p className="tweetText">{props.tweet.text ?? "No tweet text"}</p>
            {props.tweet.tweetUrl ? (
              <a href={props.tweet.tweetUrl} target="_blank" rel="noreferrer" className="actionLink">
                Open tweet
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="sectionHeader">
          <div>
            <div className="sectionLabel">Original Media URLs</div>
            <h2 className="sectionTitle">Usage-level and asset-level source links</h2>
          </div>
        </div>
        <div className="detailGrid">
          <article className="fieldCard">
            <strong>Usage URLs</strong>
            <div className="urlList">
              {props.media.sourceUrl ? (
                <a href={props.media.sourceUrl} target="_blank" rel="noreferrer" className="urlLink mono">
                  {props.media.sourceUrl}
                </a>
              ) : (
                <div className="placeholder">No direct source URL</div>
              )}
              {usageUrls
                .filter((url) => url !== props.media.sourceUrl)
                .map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="urlLink mono">
                    {url}
                  </a>
                ))}
            </div>
          </article>
          <article className="fieldCard">
            <strong>Asset URLs</strong>
            <div className="urlList">
              {allAssetUrls.length > 0 ? (
                allAssetUrls.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="urlLink mono">
                    {url}
                  </a>
                ))
              ) : (
                <div className="placeholder">No asset URLs captured</div>
              )}
            </div>
          </article>
          <article className="fieldCard">
            <strong>Local Asset Files</strong>
            <div className="urlList">
              {localAssetFiles.length > 0 ? (
                localAssetFiles.map((filePath) => (
                  <div key={filePath} className="urlLink mono">
                    {filePath}
                  </div>
                ))
              ) : (
                <div className="placeholder">No persisted local asset file</div>
              )}
            </div>
          </article>
        </div>
      </section>

      {props.mediaAssetView ? (
        <section className="panel">
          <div className="sectionHeader">
            <div>
              <div className="sectionLabel">Media Asset View</div>
              <h2 className="sectionTitle mono">{props.mediaAssetView.asset.assetId}</h2>
            </div>
            <div className="chipRow">
              <span className="chip">{props.mediaAssetView.duplicateUsages.length} usages</span>
              <span className={`chip ${props.mediaAssetView.asset.starred ? "chipAccent" : ""}`}>
                {props.mediaAssetView.asset.starred ? "starred" : "not starred"}
              </span>
              <span className={`chip ${props.mediaAssetView.phashMatches.length > 0 ? "chipAccent" : ""}`}>
                pHash matches {props.mediaAssetView.phashMatches.length}
              </span>
              <span className="chip">{props.mediaAssetView.summary?.status ?? "unsummarized"}</span>
            </div>
          </div>
          <div className="buttonRow" style={{ marginBottom: 20 }}>
            <AssetStarButton
              assetId={props.mediaAssetView.asset.assetId}
              starred={props.mediaAssetView.asset.starred}
            />
          </div>

          <div className="detailGrid" style={{ marginBottom: 20 }}>
            <article className="fieldCard">
              <strong>Fingerprint</strong>
              <div className={!props.mediaAssetView.asset.fingerprint?.hex ? "placeholder" : "mono"}>
                {props.mediaAssetView.asset.fingerprint?.hex ?? "Unavailable"}
              </div>
            </article>
            <article className="fieldCard">
              <strong>Canonical File</strong>
              <div className={!props.mediaAssetView.asset.canonicalFilePath ? "placeholder" : "mono"}>
                {props.mediaAssetView.asset.canonicalFilePath ?? "No local file"}
              </div>
            </article>
          </div>

          {props.mediaAssetView.summary?.summary ? (
            <div className="detailGrid" style={{ marginBottom: 20 }}>
              <article className="fieldCard">
                <strong>Aggregate Conveys</strong>
                <div className={!props.mediaAssetView.summary.summary.conveys ? "placeholder" : undefined}>
                  {renderValue(props.mediaAssetView.summary.summary.conveys)}
                </div>
              </article>
              <article className="fieldCard">
                <strong>Aggregate User Intent</strong>
                <div className={!props.mediaAssetView.summary.summary.user_intent ? "placeholder" : undefined}>
                  {renderValue(props.mediaAssetView.summary.summary.user_intent)}
                </div>
              </article>
              <article className="fieldCard">
                <strong>Aggregate Rhetorical Role</strong>
                <div className={!props.mediaAssetView.summary.summary.rhetorical_role ? "placeholder" : undefined}>
                  {renderValue(props.mediaAssetView.summary.summary.rhetorical_role)}
                </div>
              </article>
              <article className="fieldCard">
                <strong>Aggregate Metaphor</strong>
                <div className={!props.mediaAssetView.summary.summary.metaphor ? "placeholder" : undefined}>
                  {renderValue(props.mediaAssetView.summary.summary.metaphor)}
                </div>
              </article>
            </div>
          ) : null}

          {props.mediaAssetView.phashMatches.length > 0 ? (
            <>
              <div className="sectionHeader" style={{ marginBottom: 14 }}>
                <div>
                  <div className="sectionLabel">pHash Matches</div>
                  <h2 className="sectionTitle">Nearby media across other asset groups</h2>
                </div>
              </div>
              <div className="manifestList" style={{ marginBottom: 20 }}>
                {props.mediaAssetView.phashMatches.map((match) => {
                  const previewUrl = resolveMediaDisplayUrl({
                    localFilePath: match.asset.canonicalFilePath,
                    posterUrl: match.asset.posterUrls[0],
                    previewUrl: match.asset.previewUrls[0],
                    sourceUrl: match.asset.canonicalMediaUrl
                  });

                  return (
                    <article key={`${props.mediaAssetView?.asset.assetId}-${match.asset.assetId}`} className="manifestCard">
                      {previewUrl ? (
                        <div className="matchPreview">
                          <img
                            src={previewUrl}
                            alt={match.asset.assetId}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </div>
                      ) : null}
                      <div className="chipRow" style={{ marginBottom: 10 }}>
                        <span className="chip mono">{match.asset.assetId}</span>
                        <span className="chip">distance {match.distance}</span>
                        <span className="chip">{match.usages.length} posts</span>
                      </div>
                      <div className="buttonRow">
                        {match.usages.slice(0, 3).map((usage) => (
                          <Link key={usage.usageId} href={`/usage/${usage.usageId}`} className="actionLink">
                            Open {usage.tweet.authorUsername ?? "usage"}
                          </Link>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          ) : null}

          <div className="sectionHeader" style={{ marginBottom: 14 }}>
            <div>
              <div className="sectionLabel">Exact Asset Group</div>
              <h2 className="sectionTitle">Posts sharing this clustered asset</h2>
            </div>
          </div>
          <div className="manifestList">
            {props.mediaAssetView.duplicateUsages.map((usage) => (
              <article key={usage.usageId} className="manifestCard">
                <div className="chipRow" style={{ marginBottom: 10 }}>
                  <span className="chip">{usage.tweet.authorUsername ?? "unknown author"}</span>
                  <span className="chip">{usage.analysis.status}</span>
                  <span className="chip">{formatDate(usage.tweet.createdAt)}</span>
                </div>
                <p className="tweetText">{usage.tweet.text ?? "No tweet text"}</p>
                <Link href={`/usage/${usage.usageId}`} className="actionLink">
                  Open usage
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="sectionHeader">
          <div>
            <div className="sectionLabel">Full Analysis</div>
            <h2 className="sectionTitle">All facets</h2>
          </div>
        </div>
        <div className="detailGrid">
          {props.orderedFacets.map((facet) => (
            <article key={facet.name} className="fieldCard">
              <strong>{facet.name}</strong>
              <div
                className={
                  facet.value === null || (Array.isArray(facet.value) && facet.value.length === 0)
                    ? "placeholder"
                    : undefined
                }
              >
                {renderValue(facet.value)}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
