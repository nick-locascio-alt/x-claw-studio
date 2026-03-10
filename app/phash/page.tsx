import Link from "next/link";
import { AssetStarButton } from "@/src/components/asset-star-button";
import { resolveMediaDisplayUrl } from "@/src/lib/media-display";
import { getDashboardData } from "@/src/server/data";
import { getPhashMatchClusters } from "@/src/server/media-assets";

export default function PhashPage() {
  const data = getDashboardData();
  const clusters = getPhashMatchClusters({ usages: data.tweetUsages });

  return (
    <main className="shell">
      <section className="panel">
        <div className="sectionHeader">
          <div>
            <div className="sectionLabel">pHash Gallery</div>
            <h1 className="sectionTitle">Matched media clusters</h1>
          </div>
          <Link href="/" className="actionLink">
            Back
          </Link>
        </div>
        <p className="helperText">
          Each cluster below shows all media assets connected by pHash similarity, rendered together
          in one grid.
        </p>
      </section>

      {clusters.length === 0 ? (
        <section className="panel">
          <div className="placeholder">No pHash match clusters yet.</div>
        </section>
      ) : (
        clusters.map((cluster) => (
          <section key={cluster.clusterId} className="panel">
            <div className="sectionHeader">
              <div>
                <div className="sectionLabel">Cluster</div>
                <h2 className="sectionTitle">{cluster.items.length} related assets</h2>
              </div>
            </div>

            <div className="phashGrid">
              {cluster.items.map((item) => (
                <article key={item.asset.assetId} className="phashCard">
                  <div className="phashMedia">
                    {resolveMediaDisplayUrl({
                      localFilePath: item.asset.canonicalFilePath,
                      posterUrl: item.asset.posterUrls[0],
                      previewUrl: item.asset.previewUrls[0],
                      sourceUrl: item.previewUrl
                    }) ? (
                      <img
                        src={
                          resolveMediaDisplayUrl({
                            localFilePath: item.asset.canonicalFilePath,
                            posterUrl: item.asset.posterUrls[0],
                            previewUrl: item.asset.previewUrls[0],
                            sourceUrl: item.previewUrl
                          }) ?? ""
                        }
                        alt={item.asset.assetId}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div className="placeholder">no preview</div>
                    )}
                  </div>
                  <div className="chipRow" style={{ marginTop: 12 }}>
                    <span className="chip mono">{item.asset.assetId}</span>
                    <span className="chip">{item.usageCount} usages</span>
                    <span className="chip">matches {item.phashMatchCount}</span>
                    <span className={`chip ${item.asset.starred ? "chipAccent" : ""}`}>
                      {item.asset.starred ? "starred" : "not starred"}
                    </span>
                  </div>
                  {item.representativeTweetText ? (
                    <p className="tweetText" style={{ marginTop: 10 }}>{item.representativeTweetText}</p>
                  ) : null}
                  <div className="buttonRow" style={{ marginTop: 10 }}>
                    {item.representativeUsageId ? (
                      <Link href={`/usage/${item.representativeUsageId}`} className="actionLink">
                        Open usage
                      </Link>
                    ) : null}
                    {item.representativeAuthorUsername ? (
                      <span className="chip">{item.representativeAuthorUsername}</span>
                    ) : null}
                    <AssetStarButton assetId={item.asset.assetId} starred={item.asset.starred} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}
