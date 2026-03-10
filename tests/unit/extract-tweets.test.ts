import { describe, expect, it } from "vitest";
import { extractTweetsFromHtml } from "@/src/lib/extract-tweets";

describe("extractTweetsFromHtml", () => {
  it("extracts image tweets from inline html", () => {
    const html = `
      <article data-testid="tweet">
        <div data-testid="User-Name">
          <span>Hyper Tech</span>
          <span>@hypertech</span>
        </div>
        <a href="/hypertech/status/2030821664293044552">status</a>
        <div data-testid="Tweet-User-Avatar">
          <img src="https://pbs.twimg.com/profile_images/a.jpg" />
        </div>
        <div data-testid="tweetText">AAOI insiders are selling at an unprecedented pace</div>
        <div role="group" aria-label="3 replies 7 reposts 75 likes 10,117 views"></div>
        <time datetime="2026-03-08T18:43:00.000Z"></time>
        <div data-testid="tweetPhoto">
          <img src="https://pbs.twimg.com/media/HC7tLtUaQAAtWd4?format=jpg&name=medium" />
        </div>
      </article>
    `;

    const tweets = extractTweetsFromHtml(html, "inline-image");

    expect(tweets).toHaveLength(1);
    expect(tweets[0]?.tweetId).toBe("2030821664293044552");
    expect(tweets[0]?.authorUsername).toBe("@hypertech");
    expect(tweets[0]?.media[0]?.sourceUrl).toContain("pbs.twimg.com/media/");
    expect(tweets[0]?.metrics.likes).toBe("75");
  });

  it("extracts inline video posters from inline video html", () => {
    const html = `
      <article data-testid="tweet">
        <div data-testid="User-Name">
          <span>Oliviscus AI</span>
          <span>@oliviscusAI</span>
        </div>
        <a href="/oliviscusAI/status/2030602059712471112">status</a>
        <div data-testid="tweetText">Someone just open-sourced software that sees you through walls.</div>
        <div data-testid="videoPlayer">
          <video poster="https://pbs.twimg.com/amplify_video_thumb/2030601780493500416/img/YMNF70LlXME3-Jtt.jpg">
            <source type="video/mp4" src="blob:https://x.com/d2a9e341-f315-4f7a-8f2b-9713bcf3e4d5" />
          </video>
        </div>
      </article>
    `;

    const tweets = extractTweetsFromHtml(html, "inline-video");

    expect(tweets).toHaveLength(1);
    expect(tweets[0]?.media[0]?.mediaKind).toBe("video_blob");
    expect(tweets[0]?.media[0]?.posterUrl).toContain("amplify_video_thumb");
  });
});
