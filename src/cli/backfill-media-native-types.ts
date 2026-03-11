import "@/src/lib/env";
import { backfillRawMediaNativeFiles } from "@/src/server/raw-media-backfill";

const projectRoot = process.cwd();

function run(): void {
  const result = backfillRawMediaNativeFiles(projectRoot);
  console.log(
    [
      "Raw media native-type backfill completed.",
      `runs=${result.scannedRuns}`,
      `records=${result.scannedRecords}`,
      `nativeFilesCreated=${result.nativeFilesCreated}`,
      `manifestPathsUpdated=${result.manifestPathsUpdated}`,
      `skipped=${result.skipped}`,
      `errors=${result.errors}`
    ].join(" ")
  );
}

try {
  run();
} catch (error) {
  console.error("Raw media native-type backfill failed.", error);
  process.exit(1);
}
