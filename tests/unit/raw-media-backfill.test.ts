import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { backfillRawMediaNativeFiles } from "@/src/server/raw-media-backfill";
import type { CrawlManifest } from "@/src/lib/types";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "twitter-trend-backfill-"));
  tempDirs.push(dir);
  return dir;
}

describe("backfillRawMediaNativeFiles", () => {
  it("creates native siblings for persisted bin files and repoints manifests", () => {
    const projectRoot = makeTempProject();
    const runDir = path.join(projectRoot, "data", "raw", "run-1");
    const mediaDir = path.join(runDir, "media");
    fs.mkdirSync(mediaDir, { recursive: true });

    const binRelativePath = path.join("data", "raw", "run-1", "media", "tweet-image.bin");
    fs.writeFileSync(path.join(projectRoot, binRelativePath), Buffer.from([0xff, 0xd8, 0xff, 0xdb]));

    const manifest: CrawlManifest = {
      runId: "run-1",
      startedAt: new Date(0).toISOString(),
      baseUrl: "https://x.com/home",
      maxScrolls: 1,
      downloadImages: true,
      downloadVideoPosters: true,
      downloadVideos: false,
      capturedTweets: [],
      interceptedMedia: [
        {
          url: "https://pbs.twimg.com/media/abc123?name=orig",
          mediaClass: "image",
          persisted: true,
          contentType: "image/jpeg",
          filePath: binRelativePath
        }
      ]
    };

    fs.writeFileSync(path.join(runDir, "manifest.json"), JSON.stringify(manifest, null, 2));

    const result = backfillRawMediaNativeFiles(projectRoot);
    const updatedManifest = JSON.parse(fs.readFileSync(path.join(runDir, "manifest.json"), "utf8")) as CrawlManifest;

    expect(result.nativeFilesCreated).toBe(1);
    expect(result.manifestPathsUpdated).toBe(1);
    expect(updatedManifest.interceptedMedia[0]?.filePath).toBe("data/raw/run-1/media/tweet-image.jpg");
    expect(fs.existsSync(path.join(projectRoot, "data", "raw", "run-1", "media", "tweet-image.jpg"))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, "data", "raw", "run-1", "media", "tweet-image.bin"))).toBe(true);
  });
});
