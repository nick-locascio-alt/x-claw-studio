import fs from "node:fs";
import path from "node:path";
import "@/src/lib/env";
import { ensureDir, writeJson } from "@/src/lib/fs";
import {
  createScrollHumanizer,
  type ScrollHumanizerDriver
} from "@/src/lib/scroll-humanizer";
import {
  chooseAttachedXTab,
  openclawRefresh,
  openclawWait,
  resolveOpenClawTabIndex
} from "@/src/server/openclaw-browser";
import { analyzeMissingUsages } from "@/src/server/analyze-missing";
import { getDashboardData } from "@/src/server/data";
import { buildMediaAssetIndex, buildMediaAssetSummaries } from "@/src/server/media-assets";
import {
  captureVisibleTweets,
  capturePageSnapshot,
  collectOpenClawRequestMedia,
  measureVisibleTweetWindow,
  persistTweetPosterMedia,
  wheelTickTab
} from "@/src/server/openclaw-capture";
import type { CrawlManifest } from "@/src/lib/types";

const projectRoot = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const rawDir = path.join(projectRoot, "data", "raw", `openclaw-${runId}`);
const htmlDir = path.join(rawDir, "html");
const manifestPath = path.join(rawDir, "manifest.json");
const mediaDir = path.join(rawDir, "media");

ensureDir(htmlDir);
ensureDir(mediaDir);

const maxScrolls = Number(process.env.MAX_SCROLLS || 20);
const scrollPauseMs = Number(process.env.SCROLL_PAUSE_MS || 5000);
const scrollStepMinPx = Number(process.env.SCROLL_STEP_MIN_PX || 260);
const scrollStepMaxPx = Number(process.env.SCROLL_STEP_MAX_PX || 720);
const scrollStepsMin = Number(process.env.SCROLL_STEPS_MIN || 3);
const scrollStepsMax = Number(process.env.SCROLL_STEPS_MAX || 6);
const scrollStepPauseMinMs = Number(process.env.SCROLL_STEP_PAUSE_MIN_MS || 500);
const scrollStepPauseMaxMs = Number(process.env.SCROLL_STEP_PAUSE_MAX_MS || 1400);
const downloadVideoPosters = process.env.DOWNLOAD_VIDEO_POSTERS !== "0";
const downloadImages = process.env.DOWNLOAD_IMAGES !== "0";
const autoAnalyzeAfterCrawl = process.env.AUTO_ANALYZE_AFTER_CRAWL !== "0";

const humanizer = createScrollHumanizer({
  capturePauseMs: scrollPauseMs,
  scrollStepMinPx,
  scrollStepMaxPx,
  scrollStepsMin,
  scrollStepsMax,
  scrollStepPauseMinMs,
  scrollStepPauseMaxMs
});

const seenTweets = new Set<string>();
const persistedUrls = new Set<string>();

function formatValue(value: string | null | undefined): string {
  return value?.trim() ? value : "unknown";
}

const manifest: CrawlManifest = {
  runId: `openclaw-${runId}`,
  startedAt: new Date().toISOString(),
  baseUrl: "attached-tab",
  maxScrolls,
  downloadImages,
  downloadVideoPosters,
  downloadVideos: false,
  capturedTweets: [],
  interceptedMedia: []
};

async function run(): Promise<void> {
  const tabIndex = resolveOpenClawTabIndex();
  const tab = await chooseAttachedXTab(tabIndex);
  const driver: ScrollHumanizerDriver = {
    refresh: () => openclawRefresh(tab.targetId),
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
  await humanizer.refreshAtStart(driver);
  const initialPage = await capturePageSnapshot(tab.targetId);
  console.log(
    [
      "Evaluated page after refresh:",
      `targetId=${tab.targetId}`,
      `title=${JSON.stringify(formatValue(initialPage.title))}`,
      `url=${formatValue(initialPage.url)}`
    ].join(" ")
  );

  if ((tab.url ?? null) !== (initialPage.url ?? null)) {
    console.warn(
      [
        "Selected tab URL differs from evaluated page URL after refresh.",
        `selected=${formatValue(tab.url)}`,
        `evaluated=${formatValue(initialPage.url)}`
      ].join(" ")
    );
  }

  for (let i = 0; i < maxScrolls; i += 1) {
    await humanizer.pauseBeforeCapture(driver);
    const tweets = await captureVisibleTweets(tab.targetId, `openclaw-scroll-${i}`, {
      maxTweets: 10
    });
    const windowStats = await measureVisibleTweetWindow(tab.targetId);
    const snapshotPath = path.join(htmlDir, `scroll-${String(i).padStart(3, "0")}.json`);
    fs.writeFileSync(
      snapshotPath,
      JSON.stringify(
        {
          windowStats,
          tweets
        },
        null,
        2
      )
    );
    let duplicateTweetCount = 0;
    for (const tweet of tweets) {
      const dedupeKey = tweet.tweetId || `${tweet.authorUsername}:${tweet.text}`;
      if (seenTweets.has(dedupeKey)) {
        duplicateTweetCount += 1;
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
      `scroll ${i + 1}/${maxScrolls}: domTweets=${windowStats.totalTweets} visibleWindow=${windowStats.visibleTweets} avgTweetPx=${Math.round(windowStats.averageTweetHeight)} captured=${tweets.length} unique=${manifest.capturedTweets.length} duplicates=${duplicateTweetCount} media=${manifest.interceptedMedia.length}`
    );
    await humanizer.scroll(driver, {
      minPx: windowStats.safeScrollMinPx,
      maxPx: windowStats.safeScrollMaxPx
    });
  }

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
  if (autoAnalyzeAfterCrawl) {
    console.log("Auto-analyzing missing usages after crawl...");
    const result = await analyzeMissingUsages();
    console.log(
      `Auto-analysis complete: completed=${result.completed} skipped=${result.skipped} failed=${result.failed} totalMissing=${result.totalMissing}`
    );
  }
  console.log(`Wrote manifest -> ${path.relative(projectRoot, manifestPath)}`);
}

run().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
