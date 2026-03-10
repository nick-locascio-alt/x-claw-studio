import fs from "node:fs";
import path from "node:path";
import "@/src/lib/env";
import { ensureDir, writeJson } from "@/src/lib/fs";
import { createScrollHumanizer, type ScrollHumanizerDriver } from "@/src/lib/scroll-humanizer";
import { chooseAttachedXTab, openclawWait, resolveOpenClawTabIndex } from "@/src/server/openclaw-browser";
import { analyzeMissingUsages } from "@/src/server/analyze-missing";
import { getDashboardData } from "@/src/server/data";
import { buildMediaAssetIndex, buildMediaAssetSummaries } from "@/src/server/media-assets";
import {
  capturePageSnapshot,
  captureVisibleTweets,
  collectOpenClawRequestMedia,
  measureVisibleTweetWindow,
  persistTweetPosterMedia,
  scrollToTopTab,
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
const maxScrolls = Number(process.env.MAX_SCROLLS || 12);
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

async function run(): Promise<void> {
  const tabIndex = resolveOpenClawTabIndex();
  const tab = await chooseAttachedXTab(tabIndex);
  const driver: ScrollHumanizerDriver = {
    refresh: async () => undefined,
    wait: (ms: number) => openclawWait(tab.targetId, ms),
    wheelTick: ({ deltaY }: { deltaY: number }) => wheelTickTab(tab.targetId, deltaY)
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
  console.log("Resetting current page to top of loaded timeline before capture...");
  await scrollToTopTab(tab.targetId);
  await openclawWait(tab.targetId, 1200);
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
    maxScrolls,
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
    maxScrolls
  });

  let duplicateTweetCount = 0;
  for (let i = 0; i < maxScrolls; i += 1) {
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
        `scroll ${i + 1}/${maxScrolls}:`,
        `domTweets=${windowStats.totalTweets}`,
        `visibleWindow=${windowStats.visibleTweets}`,
        `avgTweetPx=${Math.round(windowStats.averageTweetHeight)}`,
        `captured=${tweets.length}`,
        `unique=${manifest.capturedTweets.length}`,
        `duplicates=${duplicatesThisScroll}`,
        `media=${manifest.interceptedMedia.length}`
      ].join(" ")
    );

    if (i < maxScrolls - 1) {
      await humanizer.scroll(driver, {
        minPx: windowStats.safeScrollMinPx,
        maxPx: windowStats.safeScrollMaxPx
      });
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
  writeJson(manifestPath, manifest);

  const data = getDashboardData();
  const assetIndex = await buildMediaAssetIndex({
    usages: data.tweetUsages,
    manifests: data.manifests
  });
  buildMediaAssetSummaries({
    usages: data.tweetUsages,
    assetIndex
  });

  if (autoAnalyzeAfterCapture) {
    console.log("Auto-analyzing missing usages after current-page capture...");
    const result = await analyzeMissingUsages();
    console.log(
      `Auto-analysis complete: completed=${result.completed} skipped=${result.skipped} failed=${result.failed} totalMissing=${result.totalMissing}`
    );
  }

  console.log(
    `Captured current page: url=${page.url ?? "unknown"} title=${page.title ?? "unknown"} tweets=${manifest.capturedTweets.length} media=${manifest.interceptedMedia.length}`
  );
  console.log(`Wrote manifest -> ${path.relative(projectRoot, manifestPath)}`);
}

run().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
