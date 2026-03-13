import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const originalCwd = process.cwd();
let tempDir: string | null = null;

async function loadModule() {
  return import("@/src/server/meme-template-search");
}

async function loadStore() {
  return import("@/src/server/meme-template-store");
}

describe("meme template search", () => {
  afterEach(() => {
    process.chdir(originalCwd);
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDir = null;
  });

  it("returns imported meme templates as reply-media candidates", async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "meme-template-search-"));
    process.chdir(tempDir);

    const { upsertMemeTemplate } = await loadStore();
    upsertMemeTemplate({
      templateId: "putting-on-clown-makeup",
      key: "clown-makeup",
      label: "clown makeup",
      source: "meming_world",
      pageUrl: "https://en.meming.world/wiki/Putting_on_Clown_Makeup",
      title: "Putting on Clown Makeup",
      alternateNames: ["Clown Makeup Tutorial"],
      matchReason: "fixture",
      about: "A step-by-step clown transformation template.",
      origin: null,
      meaning: "Represents doubling down on a bad idea.",
      usageSummary: "Use it to show someone turning themselves into the clown in stages.",
      commonUseCases: ["mocking a doomed strategy", "showing a self-own"],
      whyItWorks: "The sequence makes escalation legible.",
      toneTags: ["sarcastic", "mocking"],
      baseTemplate: {
        kind: "base_template",
        sourceUrl: "https://example.com/clown.jpg",
        localFilePath: path.join(tempDir, "clown.jpg"),
        caption: null
      },
      examples: [],
      importedAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    });

    const { searchMemeTemplates } = await loadModule();
    const result = searchMemeTemplates(["clown makeup meme"]);

    expect(result.queryOutcomes).toEqual([{ query: "clown makeup meme", resultCount: 1 }]);
    expect(result.candidates[0]).toMatchObject({
      usageId: null,
      sourceType: "meme_template",
      sourceLabel: "Putting on Clown Makeup",
      localFilePath: path.join(tempDir, "clown.jpg"),
      mediaKind: "image"
    });
    expect(result.candidates[0]?.candidateId).toBe("meme-template::clown-makeup");
  });
});
