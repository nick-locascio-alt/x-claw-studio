# X Timeline Media Index

Local-first pipeline for capturing media from your X timeline, preserving tweet context, and building a retrieval-oriented index of how each image/video/GIF gets used.

## What this system is for

You wanted to answer questions like:

- what is in the media
- what does it convey
- why did the poster use it
- how is it typically used
- what metaphor or rhetorical pairing exists between the media and its text

This scaffold is built around two levels of storage:

1. Per-usage data: every time a media asset appears in a tweet, preserve the tweet, author, text, metrics, and a usage-specific semantic analysis.
2. Per-asset aggregation: summarize all known usages into one canonical profile for retrieval and later agentic search.

## Current status

Implemented now:

- a TypeScript Next.js dashboard for browsing capture and future analysis stages
- a Playwright crawler scaffold that scrolls the timeline and captures tweet HTML
- an OpenClaw extension-backed crawler that uses your existing Chrome session/tab
- response interception for `pbs.twimg.com` and `video.twimg.com`
- poster-first capture policy for videos: save poster now, keep video URL metadata, defer full video download
- Gemini multimodal analysis for a single tweet-media usage
- Chroma indexing with one document per analysis facet
- a normalized SQL schema for authors, tweets, media assets, usage analyses, and aggregate summaries

Not implemented yet:

- database writes
- deduplication by file hash / perceptual hash
- aggregate per-asset summaries across many usages

## Recommended architecture

### 1. Capture layer

Preferred: use the OpenClaw Chrome extension against your existing attached Chrome tab.

Fallback: use Playwright against a logged-in local browser session.

Capture for every seen tweet:

- tweet id and URL
- author handle, display name, avatar
- created time
- tweet body text
- engagement metrics visible in DOM
- raw article HTML
- all media URLs found in DOM and network responses

Persist raw data first. Do not make analysis part of the critical capture path.

### 2. Media persistence layer

Store assets locally under `data/raw/<run-id>/media/`.

Persist:

- original URL
- local file path
- content type
- source run id
- tweet ids that referenced the asset

Recommended capture policy:

- images: download at crawl time
- video posters: download at crawl time
- full videos / HLS segments: do not download during capture
- full video bytes: download only after the asset crosses your trending threshold

For dedupe, add both:

- `sha256` for exact duplicates
- perceptual hash for near-duplicate images and extracted video keyframes

### 3. Analysis layer

For each `tweet_media_usages` record, generate separate fields:

- `caption_brief`: literal description
- `scene_description`: what is visually happening
- `ocr_text`: text visible in the image/video
- `primary_subjects`
- `secondary_subjects`
- `visible_objects`
- `setting_context`
- `action_or_event`
- `conveys`: social or emotional meaning
- `user_intent`: why the poster likely chose it
- `rhetorical_role`: reaction image, proof, brag, dunk, illustration, meme template, status signal, etc.
- `text_media_relationship`: how the text and media reinforce or contrast
- `metaphor`: implicit pairing between text and image
- `humor_mechanism`: irony, absurdity, contrast, exaggeration, recognition
- `emotional_tone`
- `cultural_reference`
- `meme_format`
- `persuasion_strategy`
- `brand_signals`
- `trend_signal`
- `reuse_pattern`
- `why_it_works`
- `audience_takeaway`
- `search_keywords`
- `confidence_notes`
- `usage_notes`

Then summarize all usage rows into `media_asset_summary` fields so retrieval can hit both granular and aggregate interpretations.

### 4. Retrieval layer

Create embeddings for:

- tweet text
- usage-level semantic fields
- asset-level summaries
- OCR text

In the current code, each usage facet is embedded and indexed as its own Chroma document. That lets you query:

- only `metaphor`
- only `conveys`
- only `rhetorical_role`
- or the whole facet collection

At query time, retrieve both:

- specific usages that match the prompt
- canonical asset summaries that match the prompt

That gives you both "find the exact tweet usage" and "find a reusable reaction image archetype."

## Files

- [`README.md`](/Users/nicklocascio/Projects/twitter-trend/README.md)
- [`schema.sql`](/Users/nicklocascio/Projects/twitter-trend/schema.sql)
- [`src/lib/extract-tweets.ts`](/Users/nicklocascio/Projects/twitter-trend/src/lib/extract-tweets.ts)
- [`src/cli/crawl-timeline.ts`](/Users/nicklocascio/Projects/twitter-trend/src/cli/crawl-timeline.ts)
- [`src/server/data.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/data.ts)
- [`app/page.tsx`](/Users/nicklocascio/Projects/twitter-trend/app/page.tsx)

## Install

```bash
npm install
```

## Running the web app

```bash
npm run dev
```

Open [http://localhost:4105](http://localhost:4105).

The dashboard currently shows:

- media usage cards with poster/image previews
- raw crawl manifests
- placeholder analysis fields that will later be populated by your analyzer jobs
- run controls, daily schedule config, and local run/error logs
- facet search over the local Chroma index

## Run control and scheduling

The dashboard now includes:

- manual trigger buttons for `crawl_openclaw`, `crawl_timeline`, `analyze_missing`, and `rebuild_media_assets`
- persisted run history with status, timestamps, and per-run log files
- error visibility for failed runs
- a daily scheduler config that supports one or more local run times when enabled

To activate scheduled execution, run the polling daemon:

```bash
npm run scheduler
```

That daemon checks the saved schedule every minute and triggers the crawl at any configured local time slot it matches.

To recompute media fingerprints, asset clusters, and pHash match views across all saved usages:

```bash
npm run media:rebuild
```

One-command daily polling stack:

```bash
make up
```

That is the one-command local stack. It starts Next.js, the scheduler loop, and Chroma, and it restarts Next or the scheduler if they exit and restarts Chroma if heartbeat fails.

If you only want the scheduler-only path:

```bash
make daily-poll
```

## Running the crawler

Preferred extension-backed crawl:

```bash
npm run crawl:openclaw
```

Required attach flow for `crawl:openclaw`:

1. Load the OpenClaw Chrome extension in your normal Chrome.
2. Open the X tab you want to crawl.
3. Click the extension icon so the badge shows `ON`.
4. Verify `openclaw browser --browser-profile chrome tabs --json` shows that attached tab.

Fallback Playwright crawl:

```bash
npm run crawl:timeline
```

Optional env:

```bash
MAX_SCROLLS=50 SCROLL_PAUSE_MS=3000 npm run crawl:timeline
```

OpenClaw humanizer tuning:

```bash
SCROLL_STEP_MIN_PX=260
SCROLL_STEP_MAX_PX=720
SCROLL_STEPS_MIN=3
SCROLL_STEPS_MAX=6
SCROLL_STEP_PAUSE_MIN_MS=500
SCROLL_STEP_PAUSE_MAX_MS=1400
```

Notes:

- the OpenClaw extension path is the safer/default path because it uses your existing Chrome session instead of a fresh automated browser context
- `crawl:openclaw` fails fast if no attached X tab is available on the `chrome` profile
- both crawl paths refresh the page as the first action, then use the shared scroll humanizer so capture timing and scroll direction are less rigid
- by default both crawl paths auto-run missing analysis after the crawl completes; set `AUTO_ANALYZE_AFTER_CRAWL=0` to disable that
- the crawler launches Chromium non-headless so you can validate login state
- if the Playwright-managed Chromium bundle is missing, the crawler falls back to your locally installed Google Chrome; if neither is available, run `npx playwright install chromium`
- by default the crawler downloads images and video poster thumbnails, but does not download `video.twimg.com` payloads
- if X serves media through HLS playlists, the script records the `.m3u8` URL now; later you should add playlist resolution and segment download only for promoted/trending assets
- you should eventually move login/session handling to a persistent Playwright context

Current media env flags:

```bash
DOWNLOAD_IMAGES=1
DOWNLOAD_VIDEO_POSTERS=1
DOWNLOAD_VIDEOS=0
```

## Gemini analysis and Chroma search

Required env:

```bash
export GEMINI_API_KEY=...
export CHROMA_URL=http://localhost:8000
```

Optional env:

```bash
export GEMINI_ANALYSIS_MODEL=gemini-3.1-flash-lite-preview
export GEMINI_EMBEDDING_MODEL=gemini-embedding-001
export CHROMA_COLLECTION=twitter_trend_facets
```

Analyze a single tweet usage and index all facets:

```bash
npm run analyze:tweet -- 2030602059712471112 0
```

Search across all indexed facets:

```bash
npm run search:facets -- "reaction image for panic and surveillance"
```

Search only one facet:

```bash
npm run search:facets -- "symbolic pairing with text about truth" metaphor
```

Analysis files are written to:

```bash
data/analysis/tweet-usages/
```

## Tests

Unit tests:

```bash
npm test
```

Live integration tests:

```bash
LIVE_GEMINI_TESTS=1 npm run test:integration
LIVE_CHROMA_TESTS=1 npm run test:integration
LIVE_INTEGRATION_TESTS=1 npm run test:integration
```

Full end-to-end live pipeline test:

```bash
LIVE_E2E_TESTS=1 npm run test:e2e
```

Notes:

- live Gemini tests require `GOOGLE_API_KEY`
- live Chroma tests require a running local Chroma server at `CHROMA_URL`
- the live e2e test runs ingest, real Gemini analysis on a sample tweet usage, Chroma indexing, and facet search

## Make targets

Recommended top-level commands:

```bash
make test-all
make chroma-up
make test-live-gemini
make test-live-chroma
make test-live-integration
make test-live-e2e
make live-all
```

Notes:

- `make test-all` covers the non-live gate: typecheck, build, unit tests
- `make live-all` starts local Chroma and runs the full live test matrix
- `make chroma-down` removes the local Chroma container

## Suggested next build steps

1. Add SQLite writes for the schema in [`schema.sql`](/Users/nicklocascio/Projects/twitter-trend/schema.sql).
2. Add exact and perceptual dedupe before analysis.
3. Add an analyzer worker that calls external vision/OCR/embedding APIs and writes usage-level fields.
4. Add an aggregation worker that rolls usage rows into `media_asset_summary`.
5. Add a retrieval endpoint that searches both usage rows and asset summaries.
