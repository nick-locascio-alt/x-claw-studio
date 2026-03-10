import fs from "node:fs";
import path from "node:path";
import { slugify } from "@/src/lib/fs";
import type { CrawlManifest, ExtractedTweet, InterceptedMediaClass } from "@/src/lib/types";
import { evaluateOnTab, readRequests } from "@/src/server/openclaw-browser";

export interface OpenClawPersistOptions {
  projectRoot: string;
  mediaDir: string;
  downloadImages: boolean;
  downloadVideoPosters: boolean;
}

export interface VisibleTweetWindow {
  totalTweets: number;
  visibleTweets: number;
  averageTweetHeight: number;
  safeScrollMinPx: number;
  safeScrollMaxPx: number;
  scrollY: number;
}

function classifyMediaUrl(url: string): InterceptedMediaClass | null {
  if (url.includes("video.twimg.com/")) return "video";
  if (url.includes("pbs.twimg.com/amplify_video_thumb/") || url.includes("pbs.twimg.com/ext_tw_video_thumb/")) {
    return "video_poster";
  }
  if (url.includes("pbs.twimg.com/media/")) return "image";
  return null;
}

export async function persistInterceptedUrl(
  manifest: CrawlManifest,
  persistedUrls: Set<string>,
  url: string,
  mediaClass: InterceptedMediaClass,
  options: OpenClawPersistOptions
): Promise<void> {
  if (persistedUrls.has(url)) return;
  if (mediaClass === "video") {
    manifest.interceptedMedia.push({
      url,
      mediaClass,
      persisted: false,
      contentType: null
    });
    persistedUrls.add(url);
    return;
  }

  if (
    (mediaClass === "image" && !options.downloadImages) ||
    (mediaClass === "video_poster" && !options.downloadVideoPosters)
  ) {
    manifest.interceptedMedia.push({
      url,
      mediaClass,
      persisted: false,
      contentType: null
    });
    persistedUrls.add(url);
    return;
  }

  const response = await fetch(url);
  const buffer = Buffer.from(await response.arrayBuffer());
  const extension = path.extname(new URL(url).pathname) || ".bin";
  const filePath = path.join(options.mediaDir, `${slugify(url)}${extension}`);
  fs.writeFileSync(filePath, buffer);
  manifest.interceptedMedia.push({
    url,
    mediaClass,
    persisted: true,
    contentType: response.headers.get("content-type"),
    filePath: path.relative(options.projectRoot, filePath)
  });
  persistedUrls.add(url);
}

export async function collectOpenClawRequestMedia(
  targetId: string,
  manifest: CrawlManifest,
  persistedUrls: Set<string>,
  options: OpenClawPersistOptions
): Promise<void> {
  const requestLines = await readRequests(targetId);
  for (const line of requestLines) {
    const match = line.match(/https?:\/\/\S+/);
    const url = match?.[0];
    if (!url) continue;
    const mediaClass = classifyMediaUrl(url);
    if (!mediaClass) continue;
    await persistInterceptedUrl(manifest, persistedUrls, url, mediaClass, options);
  }
}

export async function persistTweetPosterMedia(
  tweet: ExtractedTweet,
  manifest: CrawlManifest,
  persistedUrls: Set<string>,
  options: OpenClawPersistOptions
): Promise<void> {
  for (const media of tweet.media) {
    const isVideo = media.mediaKind === "video" || media.mediaKind === "video_hls" || media.mediaKind === "video_blob";
    if (isVideo && media.posterUrl) {
      await persistInterceptedUrl(manifest, persistedUrls, media.posterUrl, "video_poster", options);
    }
  }
}

export async function wheelTickTab(targetId: string, deltaY: number): Promise<void> {
  await evaluateOnTab(
    targetId,
    `() => {
      const deltaY = ${deltaY};
      window.dispatchEvent(new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true }));
      window.scrollBy({ top: deltaY, left: 0, behavior: "auto" });
      return { scrollY: window.scrollY };
    }`
  );
}

export async function scrollToTopTab(targetId: string): Promise<void> {
  await evaluateOnTab(
    targetId,
    `() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return { scrollY: window.scrollY };
    }`
  );
}

export async function measureVisibleTweetWindow(targetId: string): Promise<VisibleTweetWindow> {
  const result = await evaluateOnTab(
    targetId,
    `() => {
      const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
      const viewportHeight = Math.max(window.innerHeight || 0, 1);
      const visibleRects = articles
        .map((article) => article.getBoundingClientRect())
        .filter((rect) => rect.height > 0 && rect.bottom > 0 && rect.top < viewportHeight);
      const averageTweetHeight = visibleRects.length
        ? visibleRects.reduce((sum, rect) => sum + rect.height, 0) / visibleRects.length
        : 220;
      const maxTweetsPerScroll = Math.min(4, Math.max(2, visibleRects.length + 1));
      const minTweetsPerScroll = Math.max(1, Math.min(2, maxTweetsPerScroll));
      return {
        totalTweets: articles.length,
        visibleTweets: visibleRects.length,
        averageTweetHeight,
        safeScrollMinPx: Math.max(120, Math.round(averageTweetHeight * minTweetsPerScroll)),
        safeScrollMaxPx: Math.max(220, Math.round(averageTweetHeight * maxTweetsPerScroll)),
        scrollY: window.scrollY || 0
      };
    }`
  );

  return result as VisibleTweetWindow;
}

export async function readScrollPosition(targetId: string): Promise<number> {
  const result = await evaluateOnTab(
    targetId,
    `() => window.scrollY || 0`
  );

  return typeof result === "number" ? result : 0;
}

export async function captureVisibleTweets(
  targetId: string,
  sourceName: string,
  options?: { maxTweets?: number }
): Promise<ExtractedTweet[]> {
  const extractedAt = new Date().toISOString();
  const maxTweets = Math.max(1, Math.min(40, options?.maxTweets ?? 10));
  const result = await evaluateOnTab(
    targetId,
    `() => {
      const normalizeText = (value) => {
        const text = String(value || '').replace(/\\s+/g, ' ').trim();
        return text || null;
      };

      const matchMetric = (label, pattern) => {
        const match = label.match(pattern);
        return match ? match[1] : null;
      };

      return Array.from(document.querySelectorAll('article[data-testid="tweet"]'))
        .slice(0, ${maxTweets})
        .map((article, articleIndex) => {
          const statusAnchor = article.querySelector('a[href*="/status/"]');
          const statusHref = statusAnchor ? statusAnchor.getAttribute('href') : null;
          const statusMatch = statusHref ? statusHref.match(/\\/([^/]+)\\/status\\/(\\d+)/) : null;
          const authorSpans = Array.from(article.querySelectorAll('a[href^="/"] span'))
            .map((el) => normalizeText(el.textContent))
            .filter(Boolean);
          const userNameBlock = Array.from(article.querySelectorAll('[data-testid="User-Name"] span'))
            .map((el) => normalizeText(el.textContent))
            .filter(Boolean);
          const groupLabel = article.querySelector('[role="group"][aria-label*="views"]')?.getAttribute('aria-label') || '';
          const tweetTextEl = article.querySelector('[data-testid="tweetText"]');
          const fallbackText = normalizeText(
            Array.from(article.querySelectorAll('div[lang], span[lang]'))
              .map((el) => normalizeText(el.textContent))
              .filter(Boolean)
              .join(' ')
          );
          const tweetText = normalizeText(tweetTextEl?.textContent) || fallbackText;
          const media = [
            ...Array.from(article.querySelectorAll('[data-testid="tweetPhoto"] img[src*="pbs.twimg.com/media/"]')).map((img) => {
              const src = img.getAttribute('src');
              return { mediaKind: 'image', sourceUrl: src, previewUrl: src, posterUrl: src };
            }),
            ...Array.from(article.querySelectorAll('[data-testid="videoPlayer"] video')).map((video) => {
              const source = video.querySelector('source')?.getAttribute('src') || video.getAttribute('src') || video.getAttribute('poster');
              const poster = video.getAttribute('poster');
              return {
                mediaKind: source && source.startsWith('blob:') ? 'video_blob' : 'video',
                sourceUrl: source,
                previewUrl: poster,
                posterUrl: poster
              };
            })
          ];

          const tweet = {
            sourceName: ${JSON.stringify(sourceName)},
            tweetId: statusMatch ? statusMatch[2] : null,
            tweetUrl: statusHref ? 'https://x.com' + statusHref : null,
            authorHandle: authorSpans.find((value) => value && value.startsWith('@')) || null,
            authorUsername: statusMatch ? '@' + statusMatch[1] : (authorSpans.find((value) => value && value.startsWith('@')) || null),
            authorDisplayName: userNameBlock.find((value) => value && !value.startsWith('@')) || null,
            authorProfileImageUrl: article.querySelector('[data-testid="Tweet-User-Avatar"] img[src*="pbs.twimg.com"]')?.getAttribute('src') || null,
            createdAt: article.querySelector('time')?.getAttribute('datetime') || null,
            text: tweetText,
            metrics: {
              replies: matchMetric(groupLabel, /([\\d.,]+)\\s+repl(?:y|ies)/i),
              reposts: matchMetric(groupLabel, /([\\d.,]+)\\s+reposts?/i),
              likes: matchMetric(groupLabel, /([\\d.,]+)\\s+likes?/i),
              bookmarks: matchMetric(groupLabel, /([\\d.,]+)\\s+bookmarks?/i),
              views: matchMetric(groupLabel, /([\\d.,]+)\\s+views/i)
            },
            media,
            extraction: {
              articleIndex,
              extractedAt: ${JSON.stringify(extractedAt)}
            }
          };

          return tweet.tweetId || tweet.media.length > 0 || tweet.text ? tweet : null;
        })
        .filter(Boolean);
    }`
  );

  return Array.isArray(result) ? (result as ExtractedTweet[]) : [];
}

export async function capturePageSnapshot(targetId: string): Promise<{
  url: string | null;
  title: string | null;
  html: string;
}> {
  const result = await evaluateOnTab(
    targetId,
    `() => ({
      url: window.location.href || null,
      title: document.title || null,
      html: document.documentElement?.outerHTML || ''
    })`
  );

  return result as { url: string | null; title: string | null; html: string };
}
