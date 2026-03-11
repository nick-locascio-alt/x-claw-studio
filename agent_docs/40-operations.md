# Operations

This doc is for running and verifying the system locally.

## Main Commands

```bash
npm run dev
npm run build
npm run check
npm run lint
npm test
npm run test:integration
npm run test:e2e
```

Default web app port:

- `npm run dev` serves the Next.js app on `http://localhost:4105`
- `npm run start` serves the production app on `http://localhost:4105`

## Pipeline Commands

```bash
npm run crawl:openclaw
npm run crawl:timeline
npm run capture:openclaw-current
npm run media:backfill-native-types
npm run analyze:tweet -- <tweetId> <mediaIndex>
npm run analyze:image-prompt -- --tweet-id <tweetId> --media-index <mediaIndex> --print-prompt
npm run analyze:missing
npm run media:rebuild
npm run search:facets -- "<query>"
npm run scheduler
npm run stack
```

## Makefile Shortcuts

```bash
make help
make up
make daily-poll
make chroma-up
make chroma-down
make test-all
```

## Environment and Services

Expected external dependencies vary by command:

- OpenClaw / Chrome attachment for `crawl:openclaw`
- Playwright-capable local browser environment for `crawl:timeline`
- Gemini API key for analysis and some embedding paths
- Chroma running at `CHROMA_URL` for facet indexing and vector search

Media capture detail:

- Raw media persistence is best-effort. Failed media downloads or failed native-type writes should not abort the crawl; the run keeps going and records non-persisted items in the manifest.
- New captures keep a `.bin` compatibility copy and, when type inference succeeds, also write a preferred native file such as `.jpg`, `.png`, `.webp`, `.gif`, `.mp4`, or `.m3u8`.
- Run `npm run media:backfill-native-types` to scan existing raw media, create missing native siblings, and update manifests to prefer those typed paths.

Relevant files:

- [`src/lib/env.ts`](/Users/nicklocascio/Projects/twitter-trend/src/lib/env.ts)
- [`src/cli/analyze-image-prompt.ts`](/Users/nicklocascio/Projects/twitter-trend/src/cli/analyze-image-prompt.ts)
- [`src/server/gemini-analysis-prompt.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/gemini-analysis-prompt.ts)
- [`src/server/chroma-facets.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/chroma-facets.ts)
- [`Makefile`](/Users/nicklocascio/Projects/twitter-trend/Makefile)

## Where To Look When Something Breaks

- Run didn’t start: [`src/server/run-control.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/run-control.ts)
- Scheduler didn’t trigger: `data/control/scheduler.json` and [`src/cli/scheduler.ts`](/Users/nicklocascio/Projects/twitter-trend/src/cli/scheduler.ts)
- Crawl produced no tweets: crawl CLI plus [`src/server/openclaw-capture.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/openclaw-capture.ts)
- Analysis missing from UI: `data/analysis/tweet-usages/` and [`src/server/data.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/data.ts)
- Similarity/grouping looks wrong: [`src/server/media-assets.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/media-assets.ts)
- Search results missing: [`src/server/chroma-facets.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/chroma-facets.ts)

## Test Strategy

- Unit tests validate helpers and local contracts.
- Integration tests validate Gemini and Chroma paths when enabled.
- E2E tests validate the full pipeline when live dependencies are present.

Tests live in:

- [`tests/unit`](/Users/nicklocascio/Projects/twitter-trend/tests/unit)
- [`tests/integration`](/Users/nicklocascio/Projects/twitter-trend/tests/integration)
- [`tests/e2e`](/Users/nicklocascio/Projects/twitter-trend/tests/e2e)
