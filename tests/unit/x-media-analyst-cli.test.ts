import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = "/Users/nicklocascio/Projects/twitter-trend";
const binPath = path.join(repoRoot, "bin", "x-media-analyst.mjs");

describe("x-media-analyst binary", () => {
  it("resolves the repo root even when invoked outside the repo", async () => {
    const { stdout } = await execFileAsync("node", [binPath, "repo", "root"], {
      cwd: "/tmp"
    });

    expect(stdout.trim()).toBe(repoRoot);
  });
});
