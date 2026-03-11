# Repo Map

This is the directory-level navigation guide.

## Top Level

- [`app/`](/Users/nicklocascio/Projects/twitter-trend/app): App Router pages and API routes.
- [`src/`](/Users/nicklocascio/Projects/twitter-trend/src): main TypeScript code.
- [`data/`](/Users/nicklocascio/Projects/twitter-trend/data): local runtime artifacts and derived files.
- [`tests/`](/Users/nicklocascio/Projects/twitter-trend/tests): unit, integration, and e2e tests.
- [`schema.sql`](/Users/nicklocascio/Projects/twitter-trend/schema.sql): target relational schema, useful for future-state intent.
- [`README.md`](/Users/nicklocascio/Projects/twitter-trend/README.md): product- and operator-oriented overview.
- [`Makefile`](/Users/nicklocascio/Projects/twitter-trend/Makefile): local workflow shortcuts.

## `app/`

- [`app/page.tsx`](/Users/nicklocascio/Projects/twitter-trend/app/page.tsx): main dashboard.
- [`app/matches/page.tsx`](/Users/nicklocascio/Projects/twitter-trend/app/matches/page.tsx): duplicate/similarity explorer.
- [`app/phash/page.tsx`](/Users/nicklocascio/Projects/twitter-trend/app/phash/page.tsx): redirect to matches.
- [`app/usage/[usageId]/page.tsx`](/Users/nicklocascio/Projects/twitter-trend/app/usage/[usageId]/page.tsx): usage detail page.
- [`app/api/`](/Users/nicklocascio/Projects/twitter-trend/app/api): route handlers for UI actions and local media access.

Rule of thumb: pages are thin. If a page looks complex, the real logic is usually in `src/server` or `src/components`.

## `src/components/`

Primary dashboard components:

- [`src/components/control-panel.tsx`](/Users/nicklocascio/Projects/twitter-trend/src/components/control-panel.tsx): run buttons, scheduler config, run history.
- [`src/components/usage-queue.tsx`](/Users/nicklocascio/Projects/twitter-trend/src/components/usage-queue.tsx): main usage listing, filters, cluster view.
- [`src/components/analysis-detail.tsx`](/Users/nicklocascio/Projects/twitter-trend/src/components/analysis-detail.tsx): usage detail presentation.
- [`src/components/facet-search.tsx`](/Users/nicklocascio/Projects/twitter-trend/src/components/facet-search.tsx): local facet search UI.
- [`src/components/media-preview.tsx`](/Users/nicklocascio/Projects/twitter-trend/src/components/media-preview.tsx): media preview rendering.

## `src/cli/`

These are the user-facing operational entrypoints.

- [`src/cli/crawl-openclaw.ts`](/Users/nicklocascio/Projects/twitter-trend/src/cli/crawl-openclaw.ts): extension-backed crawl.
- [`src/cli/crawl-timeline.ts`](/Users/nicklocascio/Projects/twitter-trend/src/cli/crawl-timeline.ts): Playwright fallback crawl.
- [`src/cli/capture-openclaw-current.ts`](/Users/nicklocascio/Projects/twitter-trend/src/cli/capture-openclaw-current.ts): capture current attached tab state.
- [`src/cli/backfill-media-native-types.ts`](/Users/nicklocascio/Projects/twitter-trend/src/cli/backfill-media-native-types.ts): backfill native image or video filenames for previously saved raw media.
- [`src/cli/analyze-tweet.ts`](/Users/nicklocascio/Projects/twitter-trend/src/cli/analyze-tweet.ts): analyze one usage.
- [`src/cli/analyze-missing.ts`](/Users/nicklocascio/Projects/twitter-trend/src/cli/analyze-missing.ts): fill missing analyses.
- [`src/cli/rebuild-media-assets.ts`](/Users/nicklocascio/Projects/twitter-trend/src/cli/rebuild-media-assets.ts): rebuild asset index and summaries.
- [`src/cli/search-facets.ts`](/Users/nicklocascio/Projects/twitter-trend/src/cli/search-facets.ts): query facet index.
- [`src/cli/scheduler.ts`](/Users/nicklocascio/Projects/twitter-trend/src/cli/scheduler.ts): polling scheduler.
- [`src/cli/run-stack.ts`](/Users/nicklocascio/Projects/twitter-trend/src/cli/run-stack.ts): local stack supervisor.

## `src/server/`

This is the real backend, just without an HTTP service boundary.

- Data assembly: [`src/server/data.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/data.ts)
- Run control: [`src/server/run-control.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/run-control.ts)
- Tweet lookup: [`src/server/tweet-repository.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/tweet-repository.ts)
- Usage detail assembly: [`src/server/usage-details.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/usage-details.ts)
- OpenClaw tab control: [`src/server/openclaw-browser.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/openclaw-browser.ts)
- Capture and media persistence: [`src/server/openclaw-capture.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/openclaw-capture.ts)
- Raw media native-type backfill: [`src/server/raw-media-backfill.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/raw-media-backfill.ts)
- Gemini analysis: [`src/server/gemini-analysis.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/gemini-analysis.ts)
- Pipeline wrapper: [`src/server/analysis-pipeline.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/analysis-pipeline.ts)
- Analysis files: [`src/server/analysis-store.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/analysis-store.ts)
- Chroma indexing/search: [`src/server/chroma-facets.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/chroma-facets.ts)
- Asset rebuild / summaries / duplicate mapping: [`src/server/media-assets.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/media-assets.ts)
- Fingerprints: [`src/server/media-fingerprint.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/media-fingerprint.ts)
- Image embeddings: [`src/server/media-embedding.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/media-embedding.ts)
- Video promotion/inspection: [`src/server/media-asset-video.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/media-asset-video.ts)

## `src/lib/`

Change these only when you mean to change shared contracts or reusable behavior.

- [`src/lib/types.ts`](/Users/nicklocascio/Projects/twitter-trend/src/lib/types.ts): shared type contracts
- [`src/lib/analysis-schema.ts`](/Users/nicklocascio/Projects/twitter-trend/src/lib/analysis-schema.ts): facet schema and normalization
- [`src/lib/extract-tweets.ts`](/Users/nicklocascio/Projects/twitter-trend/src/lib/extract-tweets.ts): DOM extraction helpers
- [`src/lib/scroll-humanizer.ts`](/Users/nicklocascio/Projects/twitter-trend/src/lib/scroll-humanizer.ts): scroll plan generation
- [`src/lib/env.ts`](/Users/nicklocascio/Projects/twitter-trend/src/lib/env.ts): env loading and validation

## `data/`

- [`data/raw/`](/Users/nicklocascio/Projects/twitter-trend/data/raw): crawl outputs grouped by run id
- [`data/analysis/tweet-usages/`](/Users/nicklocascio/Projects/twitter-trend/data/analysis/tweet-usages): one JSON file per analyzed usage
- [`data/analysis/media-assets/`](/Users/nicklocascio/Projects/twitter-trend/data/analysis/media-assets): asset index, summaries, stars
- [`data/control/`](/Users/nicklocascio/Projects/twitter-trend/data/control): scheduler config, run history, logs

## `tests/`

- [`tests/unit/`](/Users/nicklocascio/Projects/twitter-trend/tests/unit): deterministic local tests
- [`tests/integration/`](/Users/nicklocascio/Projects/twitter-trend/tests/integration): service-backed tests, usually gated by env flags
- [`tests/e2e/`](/Users/nicklocascio/Projects/twitter-trend/tests/e2e): end-to-end pipeline validation
