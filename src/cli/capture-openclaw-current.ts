import fs from "node:fs";
import path from "node:path";
import "@/src/lib/env";
import { ensureDir, writeJson } from "@/src/lib/fs";
import { sleep } from "@/src/lib/sleep";
import { createScrollHumanizer, type ScrollHumanizerDriver } from "@/src/lib/scroll-humanizer";
import {
  chooseAttachedXTab,
  openclawFocus,
  openclawNavigate,
  resolveOpenClawTabIndex
} from "@/src/server/openclaw-browser";
import { buildUsageId } from "@/src/lib/usage-id";
import { normalizeXStatusUrl } from "@/src/lib/x-status-url";
import { analyzeMissingUsages } from "@/src/server/analyze-missing";
import { getDashboardData } from "@/src/server/data";
import {
  buildMediaAssetIndex,
  buildMediaAssetSummaries,
  promoteStarredAssetVideo,
  setMediaAssetStarred
} from "@/src/server/media-assets";
import {
  capturePageSnapshot,
  captureVisibleTweets,
  collectOpenClawRequestMedia,
  measureVisibleTweetWindow,
  persistTweetPosterMedia,
  readScrollPosition,
  scrollToTopTab,
  wheelBurstTab,
  wheelTickTab
} from "@/src/server/openclaw-capture";
import type { CrawlManifest } from "@/src/lib/types";

const projectRoot = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const rawDir = path.join(projectRoot, "data", "raw", `openclaw-current-${runId}`);
const htmlDir = path.join(rawDir, "html");
const manifestPath = path.join(rawDir, "manifest.json");
const mediaDir = path.join(rawDir, "media");

ensureDir(htmlDir);
ensureDir(mediaDir);

const downloadVideoPosters = process.env.DOWNLOAD_VIDEO_POSTERS !== "0";
const downloadImages = process.env.DOWNLOAD_IMAGES !== "0";
const autoAnalyzeAfterCapture = process.env.AUTO_ANALYZE_AFTER_CRAWL !== "0";
const keepScrollPosition = process.env.OPENCLAW_KEEP_SCROLL_POSITION === "1";
const openclawStartUrl = normalizeXStatusUrl(process.env.OPENCLAW_START_URL ?? null);
const maxScrolls = Number(process.env.MAX_SCROLLS || 60);
const tweetPageMaxScrolls = Number(process.env.OPENCLAW_TWEET_PAGE_MAX_SCROLLS || 5);
const effectiveMaxScrolls = openclawStartUrl ? Math.max(1, Math.min(maxScrolls, tweetPageMaxScrolls)) : maxScrolls;
const scrollPauseMs = Number(process.env.SCROLL_PAUSE_MS || 3000);

const humanizer = createScrollHumanizer({
  capturePauseMs: scrollPauseMs,
  scrollStepMinPx: 240,
  scrollStepMaxPx: 720,
  scrollStepPauseMinMs: 500,
  scrollStepPauseMaxMs: 1400
});

const persistedUrls = new Set<string>();
const seenTweets = new Set<string>();

function formatValue(value: string | null | undefined): string {
  return value?.trim() ? value : "unknown";
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 1000) {
    return `${Math.max(0, Math.round(ms))}ms`;
  }

  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

async function run(): Promise<void> {
  const runStartedAt = Date.now();
  const tabIndex = resolveOpenClawTabIndex();
  const tab = await chooseAttachedXTab(tabIndex);
  const driver: ScrollHumanizerDriver = {
    refresh: async () => undefined,
    wait: (ms: number) => sleep(ms),
    wheelTick: ({ deltaY }: { deltaY: number }) => wheelTickTab(tab.targetId, deltaY),
    wheelBurst: (steps) => wheelBurstTab(tab.targetId, steps)
  };
  console.log(
    [
      "Selected OpenClaw tab:",
      `index=${tabIndex}`,
      `targetId=${tab.targetId}`,
      `title=${JSON.stringify(formatValue(tab.title))}`,
      `url=${formatValue(tab.url)}`
    ].join(" ")
  );
  await openclawFocus(tab.targetId);
  console.log(`Focused OpenClaw tab targetId=${tab.targetId}`);
  if (openclawStartUrl) {
    console.log(`Navigating selected tab to requested tweet URL: ${openclawStartUrl}`);
    await openclawNavigate(tab.targetId, openclawStartUrl);
    await sleep(2500);
  }
  if (keepScrollPosition) {
    console.log("Keeping current scroll position for this manual run; skipping reset to top.");
  } else {
    console.log("Resetting current page to top of loaded timeline before capture...");
    await scrollToTopTab(tab.targetId);
    await sleep(1200);
  }
  const page = await capturePageSnapshot(tab.targetId);
  console.log(
    [
      "Evaluated current page:",
      `targetId=${tab.targetId}`,
      `title=${JSON.stringify(formatValue(page.title))}`,
      `url=${formatValue(page.url)}`
    ].join(" ")
  );

  if ((tab.url ?? null) !== (page.url ?? null)) {
    console.warn(
      [
        "Selected tab URL differs from evaluated page URL.",
        `selected=${formatValue(tab.url)}`,
        `evaluated=${formatValue(page.url)}`
      ].join(" ")
    );
  }

  const manifest: CrawlManifest = {
    runId: `openclaw-current-${runId}`,
    startedAt: new Date().toISOString(),
    baseUrl: page.url ?? tab.url ?? "attached-tab-current",
    maxScrolls: effectiveMaxScrolls,
    downloadImages,
    downloadVideoPosters,
    downloadVideos: false,
    capturedTweets: [],
    interceptedMedia: []
  };

  fs.writeFileSync(path.join(htmlDir, "current-page.html"), page.html);
  writeJson(path.join(htmlDir, "current-page-start.json"), {
    title: page.title,
    url: page.url,
    maxScrolls: effectiveMaxScrolls
  });

  let duplicateTweetCount = 0;
  for (let i = 0; i < effectiveMaxScrolls; i += 1) {
    await humanizer.pauseBeforeCapture(driver);
    const tweets = await captureVisibleTweets(tab.targetId, `openclaw-current-scroll-${i}`, {
      maxTweets: 10
    });
    const windowStats = await measureVisibleTweetWindow(tab.targetId);
    writeJson(path.join(htmlDir, `scroll-${String(i).padStart(3, "0")}.json`), {
      page: {
        url: page.url,
        title: page.title
      },
      windowStats,
      tweets
    });

    let duplicatesThisScroll = 0;
    for (const tweet of tweets) {
      const dedupeKey = tweet.tweetId || `${tweet.authorUsername}:${tweet.text}`;
      if (seenTweets.has(dedupeKey)) {
        duplicateTweetCount += 1;
        duplicatesThisScroll += 1;
        continue;
      }
      seenTweets.add(dedupeKey);
      await persistTweetPosterMedia(tweet, manifest, persistedUrls, {
        projectRoot,
        mediaDir,
        downloadImages,
        downloadVideoPosters
      });
      manifest.capturedTweets.push(tweet);
    }

    await collectOpenClawRequestMedia(tab.targetId, manifest, persistedUrls, {
      projectRoot,
      mediaDir,
      downloadImages,
      downloadVideoPosters
    });

    console.log(
      [
        `scroll ${i + 1}/${effectiveMaxScrolls}:`,
        `domTweets=${windowStats.totalTweets}`,
        `visibleWindow=${windowStats.visibleTweets}`,
        `avgTweetPx=${Math.round(windowStats.averageTweetHeight)}`,
        `captured=${tweets.length}`,
        `unique=${manifest.capturedTweets.length}`,
        `duplicates=${duplicatesThisScroll}`,
        `media=${manifest.interceptedMedia.length}`
      ].join(" ")
    );

      if (i < effectiveMaxScrolls - 1) {
      const scrollBefore = await readScrollPosition(tab.targetId);
      console.log(
        `scroll ${i + 1}/${effectiveMaxScrolls}: advancing fromY=${Math.round(scrollBefore)} minPx=${windowStats.safeScrollMinPx} maxPx=${windowStats.safeScrollMaxPx}`
      );
      await humanizer.scroll(driver, {
        minPx: windowStats.safeScrollMinPx,
        maxPx: windowStats.safeScrollMaxPx
      });
      const scrollAfter = await readScrollPosition(tab.targetId);
      console.log(`scroll ${i + 1}/${effectiveMaxScrolls}: advanced toY=${Math.round(scrollAfter)}`);
    }
  }

  console.log(
    [
      "Capture summary:",
      `uniqueTweets=${manifest.capturedTweets.length}`,
      `duplicateTweets=${duplicateTweetCount}`,
      `interceptedMedia=${manifest.interceptedMedia.length}`
    ].join(" ")
  );

  manifest.completedAt = new Date().toISOString();
  console.log(`Writing manifest -> ${path.relative(projectRoot, manifestPath)}`);
  writeJson(manifestPath, manifest);
  console.log(
    `Manifest written. tweets=${manifest.capturedTweets.length} media=${manifest.interceptedMedia.length} elapsed=${formatDuration(Date.now() - runStartedAt)}`
  );

  console.log("Loading dashboard data for asset rebuild...");
  const data = getDashboardData();
  console.log(
    `Dashboard data loaded. manifests=${data.manifests.length} usages=${data.tweetUsages.length} elapsed=${formatDuration(Date.now() - runStartedAt)}`
  );
  const assetBuildStartedAt = Date.now();
  console.log("Rebuilding media asset index...");
  const assetIndex = await buildMediaAssetIndex({
    usages: data.tweetUsages,
    manifests: data.manifests
  });
  console.log(
    `Media asset index rebuilt. assets=${assetIndex.assets.length} duration=${formatDuration(Date.now() - assetBuildStartedAt)} elapsed=${formatDuration(Date.now() - runStartedAt)}`
  );
  const summaryBuildStartedAt = Date.now();
  console.log("Rebuilding media asset summaries...");
  buildMediaAssetSummaries({
    usages: data.tweetUsages,
    assetIndex
  });
  console.log(
    `Media asset summaries rebuilt. duration=${formatDuration(Date.now() - summaryBuildStartedAt)} elapsed=${formatDuration(Date.now() - runStartedAt)}`
  );

  if (openclawStartUrl) {
    const topTweet =
      manifest.capturedTweets.find((tweet) => normalizeXStatusUrl(tweet.tweetUrl) === openclawStartUrl) ??
      manifest.capturedTweets[0] ??
      null;

    if (topTweet) {
      for (let mediaIndex = 0; mediaIndex < topTweet.media.length; mediaIndex += 1) {
        const usageId = buildUsageId(topTweet, mediaIndex);
        const assetId = assetIndex.usageToAssetId[usageId];
        if (!assetId) {
          continue;
        }

        if (setMediaAssetStarred(assetId, true)) {
          await promoteStarredAssetVideo(assetId);
          console.log(`Auto-starred top tweet asset ${assetId} for ${usageId}`);
        }
      }
    } else {
      console.warn(`No top tweet found to auto-star for ${openclawStartUrl}`);
    }
  }

  if (autoAnalyzeAfterCapture) {
    console.log(
      `Auto-analyzing missing usages after current-page capture... elapsed=${formatDuration(Date.now() - runStartedAt)}`
    );
    const result = await analyzeMissingUsages();
    console.log(
      `Auto-analysis complete: completed=${result.completed} skipped=${result.skipped} failed=${result.failed} totalMissing=${result.totalMissing} elapsed=${formatDuration(Date.now() - runStartedAt)}`
    );
  } else {
    console.log("Auto-analysis skipped because AUTO_ANALYZE_AFTER_CRAWL=0");
  }

  console.log(
    `Captured current page: url=${page.url ?? "unknown"} title=${page.title ?? "unknown"} tweets=${manifest.capturedTweets.length} media=${manifest.interceptedMedia.length} totalElapsed=${formatDuration(Date.now() - runStartedAt)}`
  );
}

run().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
