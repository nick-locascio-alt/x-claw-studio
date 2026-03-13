import "@/src/lib/env";
import { analyzeAllUsages } from "@/src/server/analyze-all";

async function main(): Promise<void> {
  const result = await analyzeAllUsages();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: Error) => {
  console.error(error);
  process.exit(1);
});
