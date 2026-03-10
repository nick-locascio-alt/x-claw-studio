import "@/src/lib/env";
import { ANALYSIS_FACET_NAMES } from "@/src/lib/analysis-schema";
import { searchFacetIndex } from "@/src/server/chroma-facets";

const query = process.argv[2];
const facetName = process.argv[3];

if (!query) {
  console.error(
    `Usage: tsx src/cli/search-facets.ts <query> [facetName]\nFacet names: ${ANALYSIS_FACET_NAMES.join(", ")}`
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const result = await searchFacetIndex({
    query,
    facetName: facetName as (typeof ANALYSIS_FACET_NAMES)[number] | undefined
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: Error) => {
  console.error(error);
  process.exit(1);
});
