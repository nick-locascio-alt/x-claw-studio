import "@/src/lib/env";
import { analyzeMissingUsages } from "@/src/server/analyze-missing";

async function main() {
  const result = await analyzeMissingUsages();

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
