# Data Layout

This repo uses the filesystem as the live application store.

## Directory Layout

```text
data/
  raw/
    <run-id>/
      manifest.json
      media/...
  analysis/
    tweet-usages/
      <usageId>.json
    media-assets/
      index.json
      summaries.json
      stars.json
  control/
    scheduler.json
    run-history.json
    logs/*.log
```

## What Each Area Means

### `data/raw/`

Per-crawl artifacts. Each run has a unique run id and a `manifest.json` that includes:

- run metadata
- captured tweets
- intercepted media
- whether images, posters, or videos were downloaded
- native media file paths when type inference succeeds, while raw compatibility `.bin` copies may exist alongside them in `media/`

Primary type: [`CrawlManifest`](/Users/nicklocascio/Projects/twitter-trend/src/lib/types.ts)

### `data/analysis/tweet-usages/`

Per-usage semantic analysis files. One media usage per file.

Primary type: [`UsageAnalysis`](/Users/nicklocascio/Projects/twitter-trend/src/lib/types.ts)

Written by:

- [`src/server/analysis-store.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/analysis-store.ts)

### `data/analysis/media-assets/`

Cross-usage asset-level records.

- `index.json`: asset records plus `usageId -> assetId` mapping
- `summaries.json`: aggregated asset-level summaries
- `stars.json`: user-starred asset ids

Primary types:

- [`MediaAssetRecord`](/Users/nicklocascio/Projects/twitter-trend/src/lib/types.ts)
- [`MediaAssetSummary`](/Users/nicklocascio/Projects/twitter-trend/src/lib/types.ts)

### `data/control/`

Operational state.

- `scheduler.json`: persisted scheduler config
- `run-history.json`: task execution history
- `logs/*.log`: stdout/stderr capture for task runs

Primary types:

- [`SchedulerConfig`](/Users/nicklocascio/Projects/twitter-trend/src/lib/types.ts)
- [`RunHistoryEntry`](/Users/nicklocascio/Projects/twitter-trend/src/lib/types.ts)

## Contract Hierarchy

When changing shape, check these in order:

1. [`src/lib/types.ts`](/Users/nicklocascio/Projects/twitter-trend/src/lib/types.ts)
2. [`src/lib/analysis-schema.ts`](/Users/nicklocascio/Projects/twitter-trend/src/lib/analysis-schema.ts)
3. The writer module in `src/server`
4. `getDashboardData()` consumers in UI code
5. Relevant tests under [`tests/`](/Users/nicklocascio/Projects/twitter-trend/tests)

## Important Current Reality

- `schema.sql` exists, but the live app path is file-backed.
- The dashboard merges saved analyses with synthetic pending rows.
- The dashboard read model enriches each `TweetUsageRecord` with duplicate-group metadata and a computed hotness score; those values are derived at read time and are not persisted as separate JSON files.
- Asset summaries may be fallback summaries when only one complete usage analysis exists.
