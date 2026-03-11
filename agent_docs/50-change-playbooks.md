# Change Playbooks

Use this when you know what kind of change you need to make but not where to start.

## Add Or Change a Dashboard View

1. Start with the page in [`app/`](/Users/nicklocascio/Projects/twitter-trend/app).
2. Inspect the rendering component in [`src/components/`](/Users/nicklocascio/Projects/twitter-trend/src/components).
3. Trace data back to [`src/server/data.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/data.ts) or [`src/server/usage-details.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/usage-details.ts).
4. If shape changes are required, update [`src/lib/types.ts`](/Users/nicklocascio/Projects/twitter-trend/src/lib/types.ts) and the producing server module.

## Change Crawl Behavior

1. Pick the trigger path: OpenClaw or Playwright CLI.
2. Update capture/orchestration in the matching CLI file.
3. Update browser interaction or persistence helpers in [`src/server/openclaw-capture.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/openclaw-capture.ts) or [`src/lib/extract-tweets.ts`](/Users/nicklocascio/Projects/twitter-trend/src/lib/extract-tweets.ts).
4. Verify the resulting `manifest.json` shape still matches [`src/lib/types.ts`](/Users/nicklocascio/Projects/twitter-trend/src/lib/types.ts).

## Change Analysis Fields

1. Update [`src/lib/analysis-schema.ts`](/Users/nicklocascio/Projects/twitter-trend/src/lib/analysis-schema.ts).
2. Update [`src/lib/types.ts`](/Users/nicklocascio/Projects/twitter-trend/src/lib/types.ts) if the contract changes.
3. Update Gemini prompt/output handling in [`src/server/gemini-analysis.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/gemini-analysis.ts).
4. Use [`src/cli/analyze-image-prompt.ts`](/Users/nicklocascio/Projects/twitter-trend/src/cli/analyze-image-prompt.ts) to iterate on prompt wording against a real tweet or local image before changing the main pipeline behavior.
5. Update any Chroma indexing logic in [`src/server/chroma-facets.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/chroma-facets.ts).
6. Update detail UI and tests.

## Change Asset Grouping, pHash, Or Promotion

1. Start in [`src/server/media-assets.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/media-assets.ts).
2. Inspect helper modules [`src/server/media-fingerprint.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/media-fingerprint.ts), [`src/server/media-embedding.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/media-embedding.ts), and [`src/server/media-asset-video.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/media-asset-video.ts).
3. Rebuild with `npm run media:rebuild`.
4. Verify in the match explorer and unit tests.

## Change Scheduling Or Run Controls

1. Start in [`src/server/run-control.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/run-control.ts).
2. Check polling behavior in [`src/cli/scheduler.ts`](/Users/nicklocascio/Projects/twitter-trend/src/cli/scheduler.ts).
3. Check the UI surface in [`src/components/control-panel.tsx`](/Users/nicklocascio/Projects/twitter-trend/src/components/control-panel.tsx).
4. Verify `data/control/scheduler.json` and `data/control/run-history.json` semantics.

## Change Search

1. Start in [`src/server/chroma-facets.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/chroma-facets.ts).
2. Distinguish lexical fallback behavior from vector behavior before changing ranking.
3. Verify the UI in [`src/components/facet-search.tsx`](/Users/nicklocascio/Projects/twitter-trend/src/components/facet-search.tsx).

## Safe Editing Sequence

1. Read the producing module.
2. Read the shared type.
3. Read the main consumer.
4. Update the narrowest layer possible.
5. Run the smallest relevant test suite.
