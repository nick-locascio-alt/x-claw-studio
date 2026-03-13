import "@/src/lib/env";
import { runOpenClawCurrentCapture } from "@/src/server/openclaw-current-capture";

async function run(): Promise<void> {
  await runOpenClawCurrentCapture({
    mode: "current_page"
  });
}

run().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
