import path from "node:path";
import { spawnDetachedNodeScript } from "@/src/server/cli-process";

const projectRoot = process.cwd();
const analyzeMissingScriptPath = path.join(projectRoot, "src", "cli", "analyze-missing.ts");

export function queueMissingUsageAnalysis(sourceLabel: string): boolean {
  try {
    spawnDetachedNodeScript({
      cwd: projectRoot,
      scriptPath: analyzeMissingScriptPath,
      env: process.env
    });
    console.log(`Queued detached missing-usage analysis after ${sourceLabel}.`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to queue detached missing-usage analysis after ${sourceLabel}: ${message}`);
    return false;
  }
}
