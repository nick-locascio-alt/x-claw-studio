import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const originalCwd = process.cwd();
let tempDir: string | null = null;

async function loadModule() {
  return import("@/src/server/reply-media-wishlist");
}

describe("reply media wishlist", () => {
  afterEach(() => {
    process.chdir(originalCwd);
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDir = null;
  });

  it("records and dedupes missing meme/media ideas", async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reply-wishlist-"));
    process.chdir(tempDir);

    const { readReplyMediaWishlist, recordReplyMediaWishlist, findRelatedReplyMediaWishlistKeys } = await loadModule();

    recordReplyMediaWishlist({
      usageId: "usage-1",
      goal: "insight",
      queryLabels: ["scooby doo mask reveal", "always has been astronaut"],
      angle: "Show the betrayal as a reveal",
      tweetText: "Cloudflare became the thing it opposed."
    });

    recordReplyMediaWishlist({
      usageId: "usage-2",
      goal: "consequence",
      queryLabels: ["scooby doo mask reveal", "trojan horse"],
      angle: "Show the consequence of the reveal",
      tweetText: "The moat became the product."
    });

    const entries = readReplyMediaWishlist();
    const scooby = entries.find((entry) => entry.label === "scooby doo mask reveal");

    expect(entries).toHaveLength(3);
    expect(scooby).toMatchObject({
      occurrenceCount: 2
    });
    expect(scooby?.usageIds).toEqual(["usage-1", "usage-2"]);
    expect(scooby?.goals).toEqual(["insight", "consequence"]);
    expect(
      findRelatedReplyMediaWishlistKeys({
        key: "scooby-doo-mask-reveal",
        label: "scooby doo mask reveal",
        relatedLabels: ["Scooby-Doo mask reveal meme"]
      })
    ).toEqual(["scooby-doo-mask-reveal"]);
  });

  it("stores tweet-only wishlist entries without usage ids", async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reply-wishlist-"));
    process.chdir(tempDir);

    const { readReplyMediaWishlist, recordReplyMediaWishlist } = await loadModule();

    recordReplyMediaWishlist({
      usageId: null,
      goal: "support",
      queryLabels: ["grim nod"],
      angle: "Back the tweet without needing source media",
      tweetText: "This is the obvious end state."
    });

    const entries = readReplyMediaWishlist();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.usageIds).toEqual([]);
  });

  it("finds close wishlist aliases for imported meme templates", async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reply-wishlist-"));
    process.chdir(tempDir);

    const {
      recordReplyMediaWishlist,
      findRelatedReplyMediaWishlistKeys,
      setReplyMediaWishlistStatuses,
      readReplyMediaWishlist
    } = await loadModule();

    recordReplyMediaWishlist({
      usageId: "usage-1",
      goal: "insight",
      queryLabels: ["clown makeup", "clown putting on makeup", "clown makeup meme"],
      angle: "Show a step-by-step collapse into obvious foolishness",
      tweetText: "The reward for adapting is just another cycle."
    });

    const keys = findRelatedReplyMediaWishlistKeys({
      key: "clown-makeup",
      label: "clown makeup",
      relatedLabels: ["Putting on Clown Makeup", "Clown Makeup Tutorial"]
    });

    expect(keys.sort()).toEqual(["clown-makeup", "clown-makeup-meme", "clown-putting-on-makeup"]);

    setReplyMediaWishlistStatuses(keys, "collected");

    expect(readReplyMediaWishlist().every((entry) => entry.status === "collected")).toBe(true);
  });
});
