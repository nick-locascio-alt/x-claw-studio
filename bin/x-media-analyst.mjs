#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const binDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(binDir, "..");
const entrypoint = path.join(repoRoot, "src", "cli", "x-media-analyst.ts");

const child = spawn(process.execPath, ["--import", "tsx", entrypoint, ...process.argv.slice(2)], {
  cwd: repoRoot,
  env: {
    ...process.env,
    X_TREND_PROJECT_ROOT: repoRoot
  },
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

child.on("error", (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
