import fs from "node:fs";
import path from "node:path";
import { ensureDir, writeJson } from "@/src/lib/fs";
import { sleep } from "@/src/lib/sleep";
import { createScrollHumanizer, type ScrollHumanizerDriver } from "@/src/lib/scroll-humanizer";
import { buildUsageId } from "@/src/lib/usage-id";
import type { CrawlManifest, ExtractedTweet } from "@/src/lib/types";
import { normalizeXStatusUrl } from "@/src/lib/x-status-url";
import { getDashboardData } from "@/src/server/data";
import {
  buildMediaAssetIndex,
  buildMediaAssetSummaries,
  promoteStarredAssetVideo,
  setMediaAssetStarred
} from "@/src/server/media-assets";
import {
  chooseAttachedXTab,
  openclawFocus,
  openclawNavigate,
  resolveOpenClawTabIndex
} from "@/src/server/openclaw-browser";
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
import { queueMissingUsageAnalysis } from "@/src/server/auto-analysis";

export type OpenClawCurrentCaptureMode = "current_page" | "tweet_thread";

export interface OpenClawCurrentCapturePlan {
  effectiveMaxScrolls: number;
  captureTweetLimit: number;
  stopAfterUniqueTweets: number | null;
  forceScrollToTop: boolean;
}

export interface OpenClawCurrentCaptureResult {
  manifest: CrawlManifest;
  manifestPath: string;
  rawDir: string;
  topTweet: ExtractedTweet | null;
}

interface OpenClawCurrentCaptureDependencies {
  now?: () => Date;
  log?: (message: string) => void;
}

const projectRoot = process.cwd();
const downloadVideoPosters = process.env.DOWNLOAD_VIDEO_POSTERS !== "0";
const downloadImages = process.env.DOWNLOAD_IMAGES !== "0";
const autoAnalyzeAfterCapture = process.env.AUTO_ANALYZE_AFTER_CRAWL !== "0";
const configuredMaxScrolls = Number(process.env.MAX_SCROLLS || 60);
const defaultTweetPageMaxScrolls = Number(process.env.OPENCLAW_TWEET_PAGE_MAX_SCROLLS || 5);
const focusedTweetThreadMaxScrolls = Number(process.env.OPENCLAW_CURRENT_TWEET_MAX_SCROLLS || 3);
const focusedTweetThreadTargetCount = Number(process.env.OPENCLAW_CURRENT_TWEET_TARGET_COUNT || 11);
const scrollPauseMs = Number(process.env.SCROLL_PAUSE_MS || 3000);

export function resolveOpenClawCurrentCapturePlan(input: {
  mode: OpenClawCurrentCaptureMode;
  openclawStartUrl: string | null;
  maxScrolls?: number;
  tweetPageMaxScrolls?: number;
  focusedMaxScrolls?: number;
  focusedTargetCount?: number;
}): OpenClawCurrentCapturePlan {
  const maxScrolls = Math.max(1, input.maxScrolls ?? configuredMaxScrolls);
  const tweetPageMaxScrolls = Math.max(1, input.tweetPageMaxScrolls ?? defaultTweetPageMaxScrolls);
  const focusedMaxScrolls = Math.max(1, input.focusedMaxScrolls ?? focusedTweetThreadMaxScrolls);
  const focusedTargetCount = Math.max(2, input.focusedTargetCount ?? focusedTweetThreadTargetCount);

  if (input.mode === "tweet_thread") {
    return {
      effectiveMaxScrolls: Math.min(maxScrolls, focusedMaxScrolls),
      captureTweetLimit: Math.min(20, focusedTargetCount + 1),
      stopAfterUniqueTweets: focusedTargetCount,
      forceScrollToTop: true
    };
  }

  if (input.openclawStartUrl) {
    return {
      effectiveMaxScrolls: Math.min(maxScrolls, tweetPageMaxScrolls),
      captureTweetLimit: 10,
      stopAfterUniqueTweets: null,
      forceScrollToTop: false
    };
  }

  return {
    effectiveMaxScrolls: maxScrolls,
    captureTweetLimit: 10,
    stopAfterUniqueTweets: null,
    forceScrollToTop: false
  };
}

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

export async function runOpenClawCurrentCapture(
  input: {
    mode?: OpenClawCurrentCaptureMode;
    openclawStartUrl?: string | null;
  },
  dependencies?: OpenClawCurrentCaptureDependencies
): Promise<OpenClawCurrentCaptureResult> {
  const log = dependencies?.log ?? console.log;
  const now = dependencies?.now ?? (() => new Date());
  const runStartedAt = now().getTime();
  const timestampSeed = now().toISOString();
  const runId = timestampSeed.replace(/[:.]/g, "-");
  const rawDir = path.join(projectRoot, "data", "raw", `openclaw-current-${runId}`);
  const htmlDir = path.join(rawDir, "html");
  const manifestPath = path.join(rawDir, "manifest.json");
  const mediaDir = path.join(rawDir, "media");
  const openclawStartUrl = normalizeXStatusUrl(input.openclawStartUrl ?? process.env.OPENCLAW_START_URL ?? null);
  const mode = input.mode ?? "current_page";
  const plan = resolveOpenClawCurrentCapturePlan({
    mode,
    openclawStartUrl
  });

  ensureDir(htmlDir);
  ensureDir(mediaDir);

  const humanizer = createScrollHumanizer({
    capturePauseMs: scrollPauseMs,
    scrollStepMinPx: 240,
    scrollStepMaxPx: 720,
    scrollStepPauseMinMs: 500,
    scrollStepPauseMaxMs: 1400
  });

  const persistedUrls = new Set<string>();
  const seenTweets = new Set<string>();
  const tabIndex = resolveOpenClawTabIndex();
  const tab = await chooseAttachedXTab(tabIndex);
  const driver: ScrollHumanizerDriver = {
    refresh: async () => undefined,
    wait: (ms: number) => sleep(ms),
    wheelTick: ({ deltaY }: { deltaY: number }) => wheelTickTab(tab.targetId, deltaY),
    wheelBurst: (steps) => wheelBurstTab(tab.targetId, steps)
  };

  log(
    [
      "Selected OpenClaw tab:",
      `index=${tabIndex}`,
      `targetId=${tab.targetId}`,
      `title=${JSON.stringify(formatValue(tab.title))}`,
      `url=${formatValue(tab.url)}`
    ].join(" ")
  );
  await openclawFocus(tab.targetId);
  log(`Focused OpenClaw tab targetId=${tab.targetId}`);
  if (openclawStartUrl) {
    log(`Navigating selected tab to requested tweet URL: ${openclawStartUrl}`);
    await openclawNavigate(tab.targetId, openclawStartUrl);
    await sleep(2500);
  }
  if (plan.forceScrollToTop) {
    await scrollToTopTab(tab.targetId);
    log("Reset scroll to the top so capture starts from the main tweet.");
  } else {
    log("Capturing from the tab's current scroll position.");
  }

  const page = await capturePageSnapshot(tab.targetId);
  log(
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
    startedAt: timestampSeed,
    baseUrl: page.url ?? tab.url ?? "attached-tab-current",
    maxScrolls: plan.effectiveMaxScrolls,
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
    maxScrolls: plan.effectiveMaxScrolls,
    mode
  });

  let duplicateTweetCount = 0;
  for (let i = 0; i < plan.effectiveMaxScrolls; i += 1) {
    await humanizer.pauseBeforeCapture(driver);
    const tweets = await captureVisibleTweets(tab.targetId, `openclaw-current-scroll-${i}`, {
      maxTweets: plan.captureTweetLimit
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

    log(
      [
        `scroll ${i + 1}/${plan.effectiveMaxScrolls}:`,
        `domTweets=${windowStats.totalTweets}`,
        `visibleWindow=${windowStats.visibleTweets}`,
        `avgTweetPx=${Math.round(windowStats.averageTweetHeight)}`,
        `captured=${tweets.length}`,
        `unique=${manifest.capturedTweets.length}`,
        `duplicates=${duplicatesThisScroll}`,
        `media=${manifest.interceptedMedia.length}`
      ].join(" ")
    );

    const hitFocusedTarget =
      typeof plan.stopAfterUniqueTweets === "number" && manifest.capturedTweets.length >= plan.stopAfterUniqueTweets;
    if (hitFocusedTarget) {
      log(`Focused capture target reached at ${manifest.capturedTweets.length} unique tweets.`);
      break;
    }

    if (i < plan.effectiveMaxScrolls - 1) {
      const scrollBefore = await readScrollPosition(tab.targetId);
      log(
        `scroll ${i + 1}/${plan.effectiveMaxScrolls}: advancing fromY=${Math.round(scrollBefore)} minPx=${windowStats.safeScrollMinPx} maxPx=${windowStats.safeScrollMaxPx}`
      );
      await humanizer.scroll(driver, {
        minPx: windowStats.safeScrollMinPx,
        maxPx: windowStats.safeScrollMaxPx
      });
      const scrollAfter = await readScrollPosition(tab.targetId);
      log(`scroll ${i + 1}/${plan.effectiveMaxScrolls}: advanced toY=${Math.round(scrollAfter)}`);
    }
  }

  log(
    [
      "Capture summary:",
      `uniqueTweets=${manifest.capturedTweets.length}`,
      `duplicateTweets=${duplicateTweetCount}`,
      `interceptedMedia=${manifest.interceptedMedia.length}`
    ].join(" ")
  );

  manifest.completedAt = new Date().toISOString();
  log(`Writing manifest -> ${path.relative(projectRoot, manifestPath)}`);
  writeJson(manifestPath, manifest);
  log(
    `Manifest written. tweets=${manifest.capturedTweets.length} media=${manifest.interceptedMedia.length} elapsed=${formatDuration(Date.now() - runStartedAt)}`
  );

  log("Loading dashboard data for asset rebuild...");
  const data = getDashboardData();
  log(
    `Dashboard data loaded. manifests=${data.manifests.length} usages=${data.tweetUsages.length} elapsed=${formatDuration(Date.now() - runStartedAt)}`
  );
  const assetBuildStartedAt = Date.now();
  log("Rebuilding media asset index...");
  const assetIndex = await buildMediaAssetIndex({
    usages: data.tweetUsages,
    manifests: data.manifests
  });
  log(
    `Media asset index rebuilt. assets=${assetIndex.assets.length} duration=${formatDuration(Date.now() - assetBuildStartedAt)} elapsed=${formatDuration(Date.now() - runStartedAt)}`
  );
  const summaryBuildStartedAt = Date.now();
  log("Rebuilding media asset summaries...");
  buildMediaAssetSummaries({
    usages: data.tweetUsages,
    assetIndex
  });
  log(
    `Media asset summaries rebuilt. duration=${formatDuration(Date.now() - summaryBuildStartedAt)} elapsed=${formatDuration(Date.now() - runStartedAt)}`
  );

  const topTweet =
    (openclawStartUrl
      ? manifest.capturedTweets.find((tweet) => normalizeXStatusUrl(tweet.tweetUrl) === openclawStartUrl)
      : null) ??
    manifest.capturedTweets[0] ??
    null;

  if (openclawStartUrl) {
    if (topTweet) {
      for (let mediaIndex = 0; mediaIndex < topTweet.media.length; mediaIndex += 1) {
        const usageId = buildUsageId(topTweet, mediaIndex);
        const assetId = assetIndex.usageToAssetId[usageId];
        if (!assetId) {
          continue;
        }

        if (setMediaAssetStarred(assetId, true)) {
          await promoteStarredAssetVideo(assetId);
          log(`Auto-starred top tweet asset ${assetId} for ${usageId}`);
        }
      }
    } else {
      console.warn(`No top tweet found to auto-star for ${openclawStartUrl}`);
    }
  }

  if (autoAnalyzeAfterCapture) {
    log(
      `Queueing detached missing-usage analysis after current-page capture... elapsed=${formatDuration(Date.now() - runStartedAt)}`
    );
    queueMissingUsageAnalysis("current-page capture");
  } else {
    log("Auto-analysis skipped because AUTO_ANALYZE_AFTER_CRAWL=0");
  }

  log(
    `Captured current page: url=${page.url ?? "unknown"} title=${page.title ?? "unknown"} tweets=${manifest.capturedTweets.length} media=${manifest.interceptedMedia.length} totalElapsed=${formatDuration(Date.now() - runStartedAt)}`
  );

  return {
    manifest,
    manifestPath,
    rawDir,
    topTweet
  };
}
