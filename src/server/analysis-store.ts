import fs from "node:fs";
import path from "node:path";
import { normalizeUsageAnalysis } from "@/src/lib/analysis-schema";
import { ensureDir, writeJson } from "@/src/lib/fs";
import type { UsageAnalysis } from "@/src/lib/types";

const projectRoot = process.cwd();
const analysisDir = path.join(projectRoot, "data", "analysis", "tweet-usages");

export function getAnalysisPath(usageId: string): string {
  return path.join(analysisDir, `${usageId}.json`);
}

export function writeUsageAnalysis(analysis: UsageAnalysis): string {
  const normalized = normalizeUsageAnalysis(analysis);
  const filePath = getAnalysisPath(normalized.usageId);
  ensureDir(path.dirname(filePath));
  writeJson(filePath, normalized);
  return filePath;
}

export function readUsageAnalysis(usageId: string): UsageAnalysis | null {
  const filePath = getAnalysisPath(usageId);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return normalizeUsageAnalysis(
    JSON.parse(fs.readFileSync(filePath, "utf8")) as UsageAnalysis
  );
}

export function readAllUsageAnalyses(): UsageAnalysis[] {
  if (!fs.existsSync(analysisDir)) {
    return [];
  }

  return fs
    .readdirSync(analysisDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) =>
      normalizeUsageAnalysis(
        JSON.parse(fs.readFileSync(path.join(analysisDir, fileName), "utf8")) as UsageAnalysis
      )
    )
    .sort((a, b) => a.usageId.localeCompare(b.usageId));
}
