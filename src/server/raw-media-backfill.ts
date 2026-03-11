import fs from "node:fs";
import path from "node:path";
import { inferMediaExtension, inferMediaExtensionFromBuffer, writeJson } from "@/src/lib/fs";
import type { CrawlManifest } from "@/src/lib/types";

export interface RawMediaBackfillResult {
  scannedRuns: number;
  scannedRecords: number;
  nativeFilesCreated: number;
  manifestPathsUpdated: number;
  skipped: number;
  errors: number;
}

function findExistingMediaPath(projectRoot: string, relativePath: string): string | null {
  const absolutePath = path.join(projectRoot, relativePath);
  if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
    return absolutePath;
  }

  const extension = path.extname(relativePath);
  const binFallbackPath =
    extension.toLowerCase() === ".bin"
      ? absolutePath
      : path.join(projectRoot, relativePath.slice(0, -extension.length) + ".bin");

  if (fs.existsSync(binFallbackPath) && fs.statSync(binFallbackPath).isFile()) {
    return binFallbackPath;
  }

  return null;
}

export function backfillRawMediaNativeFiles(projectRoot: string): RawMediaBackfillResult {
  const rawDir = path.join(projectRoot, "data", "raw");
  const result: RawMediaBackfillResult = {
    scannedRuns: 0,
    scannedRecords: 0,
    nativeFilesCreated: 0,
    manifestPathsUpdated: 0,
    skipped: 0,
    errors: 0
  };

  if (!fs.existsSync(rawDir)) {
    return result;
  }

  const runDirs = fs
    .readdirSync(rawDir)
    .map((entry) => path.join(rawDir, entry))
    .filter((entry) => fs.existsSync(path.join(entry, "manifest.json")));

  for (const runDir of runDirs) {
    result.scannedRuns += 1;
    const manifestPath = path.join(runDir, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as CrawlManifest;
    let manifestChanged = false;

    for (const intercepted of manifest.interceptedMedia) {
      result.scannedRecords += 1;

      if (!intercepted.persisted || !intercepted.filePath) {
        result.skipped += 1;
        continue;
      }

      try {
        const existingPath = findExistingMediaPath(projectRoot, intercepted.filePath);
        if (!existingPath) {
          result.skipped += 1;
          continue;
        }

        const buffer = fs.readFileSync(existingPath);
        const nativeExtension =
          inferMediaExtension(intercepted.url, intercepted.contentType) ??
          inferMediaExtensionFromBuffer(buffer);

        if (!nativeExtension || nativeExtension === ".bin") {
          result.skipped += 1;
          continue;
        }

        const fileDir = path.dirname(existingPath);
        const baseName = path.basename(existingPath, path.extname(existingPath));
        const nativePath = path.join(fileDir, `${baseName}${nativeExtension}`);
        if (!fs.existsSync(nativePath)) {
          fs.writeFileSync(nativePath, buffer);
          result.nativeFilesCreated += 1;
        }

        const nativeRelativePath = path.relative(projectRoot, nativePath);
        if (intercepted.filePath !== nativeRelativePath) {
          intercepted.filePath = nativeRelativePath;
          manifestChanged = true;
          result.manifestPathsUpdated += 1;
        }
      } catch (error) {
        result.errors += 1;
        console.warn(`Failed to backfill native media file for ${intercepted.url}.`, error);
      }
    }

    if (manifestChanged) {
      writeJson(manifestPath, manifest);
    }
  }

  return result;
}
