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

Installed CLI from any directory:

```bash
npm link
x-media-analyst help
x-media-analyst repo root
```

Default web app port:

- `npm run dev` serves the Next.js app on `http://localhost:4105`
- `npm run start` serves the production app on `http://localhost:4105`

## Pipeline Commands

```bash
npm run crawl:openclaw
npm run crawl:timeline
npm run capture:openclaw-current
npm run capture:openclaw-current-tweet
npm run capture:openclaw-current-tweet-and-compose-replies
npm run media:backfill-native-types
npm run analyze:tweet -- <tweetId> <mediaIndex>
npm run analyze:image-prompt -- --tweet-id <tweetId> --media-index <mediaIndex> --print-prompt
npm run analyze:all
npm run analyze:missing
npm run analyze:topics -- --limit 100
npm run media:rebuild
npm run search:facets -- "<query>"
npm run search:topics -- "<query>"
npm run scheduler
npm run stack
```

Agent-friendly search CLI:

- `x-media-analyst facet list` prints the facet catalog with names, value types, and descriptions.
- `x-media-analyst search facets --query "terminal dashboard" --facet scene_description --limit 5` returns enriched JSON with usage IDs, tweet IDs, tweet URLs, media URLs, scores, matched facet metadata, and full analysis payloads.
- `x-media-analyst search facets --query "reaction image" --format jsonl` emits one JSON object per line for pipeline-friendly consumers.
- `x-media-analyst search topics --query "OpenAI pricing backlash" --limit 5` returns topic-level hits with stance, sentiment, why-now notes, linked usage IDs, and search scores.
- `x-media-analyst` resolves the repo root from its installed binary, so it can be run outside the repository working directory after `npm link`.

Reply wishlist CLI:

- `x-media-analyst wishlist list` prints the current desired asset backlog.
- `x-media-analyst wishlist list --status pending --format jsonl` filters to pending entries and emits one JSON object per line.
- `x-media-analyst wishlist status --key scooby-doo-mask-reveal --status collected` marks a sourced item as collected.
- `x-media-analyst wishlist import --key scooby-doo-mask-reveal` uses Gemini CLI plus meming.world to import a template record and local assets for that wishlist entry.
- If meming.world does not yield a usable page or image, the import path falls back to Gemini Google Search grounding and a generic webpage image-extraction pass.

Reply-composer model CLI:

- The usage-detail reply composer uses the separate `gemini` CLI in headless mode, not the repo's Gemini API helper path.
- Required local dependency: installed and authenticated `gemini` command available on `PATH`, or override with `GEMINI_CLI_PATH`.
- Optional env knobs: `GEMINI_CLI_TIMEOUT_MS`, `REPLY_MEDIA_SEARCH_TIMEOUT_MS`.
- The flow runs two Gemini CLI calls: first to plan angle and search terms, then to choose a candidate media result and write the final reply draft.
- Those Gemini CLI prompts directly load `@.agents/skills/stop-slop/SKILL.md` so prose cleanup happens inside the model run rather than only after the fact.
- The reply composer UI now has both `Compose reply` for the selected goal and `Compose all goals` to generate one pairing for every response goal and compare them in one batch.
- Reply, topic-post, and media-post compose runs all save their planned asset-retrieval terms into `data/analysis/reply-media-wishlist.json`, deduped by wishlist key so the backlog grows without duplicate entries.
- The wishlist UI can trigger a meming.world import, which saves template metadata to `data/analysis/meme-templates/index.json` and downloads the base template plus examples under `data/analysis/meme-templates/assets/`.
- The wishlist UI action is broader than meming.world now: it tries meming.world first, then grounded web lookup when needed.

Topic-post composer:

- The `/topics` page now includes a composer that drafts an original tweet from a selected topic cluster and pairs it with local media.
- It uses Gemini CLI, the same local `x-media-analyst search facets` retrieval path, and streamed progress updates through `POST /api/topics/compose`.
- Required local dependency is the same as the reply composer: installed/authenticated `gemini` on `PATH`, or `GEMINI_CLI_PATH`.

Media-post composer:

- The usage detail page now includes a composer that drafts an original tweet around the current asset instead of replying to the source tweet.
- It uses Gemini CLI plus the current asset's saved analysis, relevant topic hits, and prior usages, and it can compare the current asset against alternate local candidates before finalizing the draft.
- If the asset has a local file path, that file is attached into the Gemini CLI prompt so the model can inspect the actual media while drafting.

Generated drafts:

- Compose runs now persist to `data/analysis/generated-drafts/index.json`.
- Open `/drafts` in the app to browse replies, topic posts, and media-led drafts in one place.
- The reply composer also reads recent reply history for the current usage or tweet and shows `running`, `complete`, or `failed` entries as they update.

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
- Gemini CLI install and auth for the usage-detail reply composer
- Chroma running at `CHROMA_URL` for facet indexing and vector search

OpenClaw crawl note:

- `crawl:openclaw` now probes the requested X tab before starting work.
- If the requested tab is listed in `openclaw ... tabs --json` but fails control calls with `tab not found`, the crawler skips that ghost handle and falls back to another healthy X tab.
- If every X tab is broken, the crawl fails fast and tells you to reload or reopen the tab before rerunning.

Project-local skills:

- `@.agents/skills/stop-slop/SKILL.md` is the required prose cleanup skill used by the repo's Gemini CLI prompts.
- `@.agents/skills/nano-banana-pro/SKILL.md` is available for Gemini 3 Pro image generation and editing via `uv` plus `GEMINI_API_KEY`.

Grounded topic news:

- Set `TOPIC_GROUNDED_NEWS_ENABLED=1` to let the homepage enrich the hottest fresh topics with Gemini Google Search grounding.
- Optional knobs: `TOPIC_GROUNDED_NEWS_MODEL`, `TOPIC_GROUNDED_NEWS_TTL_HOURS`, `TOPIC_GROUNDED_NEWS_MAX_TOPICS`.
- Cached grounded results live at `data/analysis/topics/news.json` so repeat page loads do not trigger another search until the cache expires.
- This path uses the same `GEMINI_API_KEY` or `GOOGLE_API_KEY` env vars as the rest of the Gemini API integration.

Gemini topic analysis:

- `npm run analyze:topics -- --limit 100` analyzes up to 100 uncached tweets and rebuilds the topic index.
- Topic analysis is cached per tweet under `data/analysis/topic-tweets/`, so reruns skip already-analyzed tweets unless you pass `--force`.
- Rate-limit guardrails: single-threaded processing, `ANALYZE_TOPICS_DELAY_MS` between items, and a default batch cap from `ANALYZE_TOPICS_DEFAULT_LIMIT` (defaults to 100).
- Model selection: `GEMINI_TOPIC_MODEL` defaults to `gemini-2.5-flash-lite`.
- Topic analyses now include posture fields (`sentiment`, `stance`, `emotionalTone`, `opinionIntensity`, `targetEntity`) and are indexed into Chroma with saved usage facets as extra search text.
- If Chroma is unavailable or stale, topic search still works through lexical fallback over `data/analysis/topic-tweets/`.
- The dashboard run-control panel now exposes an `Analyze Topics` button with a topic batch-size selector, so operators do not need to leave the UI for normal topic refreshes.

Media capture detail:

- Raw media persistence is best-effort. Failed media downloads or failed native-type writes should not abort the crawl; the run keeps going and records non-persisted items in the manifest.
- New captures keep a `.bin` compatibility copy and, when type inference succeeds, also write a preferred native file such as `.jpg`, `.png`, `.webp`, `.gif`, `.mp4`, or `.m3u8`.
- When `AUTO_ANALYZE_AFTER_CRAWL=1`, scrape CLIs now queue `analyze:missing` as a detached follow-up. Gemini outages should not fail or hold open the scrape once capture and asset rebuild are done.
- `npm run capture:openclaw-current-tweet` is the tight version for a single tweet page. It resets to the top, captures the main tweet plus roughly the first 10 replies, and stops after a short bounded scroll.
- `npm run capture:openclaw-current-tweet-and-compose-replies` runs that focused capture and then saves one generated reply draft for every reply goal, using the captured top tweet as the subject.
- Run `npm run media:backfill-native-types` to scan existing raw media, create missing native siblings, and update manifests to prefer those typed paths.

Relevant files:

- [`src/lib/env.ts`](/Users/nicklocascio/Projects/twitter-trend/src/lib/env.ts)
- [`src/cli/analyze-image-prompt.ts`](/Users/nicklocascio/Projects/twitter-trend/src/cli/analyze-image-prompt.ts)
- [`src/server/gemini-analysis-prompt.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/gemini-analysis-prompt.ts)
- [`src/server/reply-composer-model.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/reply-composer-model.ts)
- [`src/server/reply-media-search.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/reply-media-search.ts)
- [`src/server/chroma-facets.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/chroma-facets.ts)
- [`src/server/gemini-topic-analysis.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/gemini-topic-analysis.ts)
- [`src/server/analyze-topics.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/analyze-topics.ts)
- [`src/server/topic-grounded-news.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/topic-grounded-news.ts)
- [`Makefile`](/Users/nicklocascio/Projects/twitter-trend/Makefile)

## Where To Look When Something Breaks

- Run didn’t start: [`src/server/run-control.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/run-control.ts)
- Scheduler didn’t trigger: `data/control/scheduler.json` and [`src/cli/scheduler.ts`](/Users/nicklocascio/Projects/twitter-trend/src/cli/scheduler.ts)
- Crawl produced no tweets: crawl CLI plus [`src/server/openclaw-capture.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/openclaw-capture.ts)
- Analysis missing from UI: `data/analysis/tweet-usages/` and [`src/server/data.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/data.ts)
- Similarity/grouping looks wrong: [`src/server/media-assets.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/media-assets.ts)
- Search results missing: [`src/server/chroma-facets.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/chroma-facets.ts)
- Topic radar looks wrong or stale: [`src/server/tweet-topics.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/tweet-topics.ts), [`src/server/gemini-topic-analysis.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/gemini-topic-analysis.ts), `data/analysis/topic-tweets/`, and `data/analysis/topics/index.json`
- Usage detail shows weak topic matches: inspect [`src/server/usage-details.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/usage-details.ts) for the query builder and [`src/server/chroma-facets.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/chroma-facets.ts) for topic indexing/search.
- Topic composer fails or picks weak media: inspect [`src/server/topic-composer.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/topic-composer.ts), [`src/server/topic-composer-prompt.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/topic-composer-prompt.ts), and [`src/server/reply-media-search.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/reply-media-search.ts).
- Media composer drafts weak posts: inspect [`src/server/media-post-composer.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/media-post-composer.ts), [`src/server/media-post-composer-prompt.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/media-post-composer-prompt.ts), and [`src/server/usage-details.ts`](/Users/nicklocascio/Projects/twitter-trend/src/server/usage-details.ts).

## Test Strategy

- Unit tests validate helpers and local contracts.
- Integration tests validate Gemini and Chroma paths when enabled.
- E2E tests validate the full pipeline when live dependencies are present.

Tests live in:

- [`tests/unit`](/Users/nicklocascio/Projects/twitter-trend/tests/unit)
- [`tests/integration`](/Users/nicklocascio/Projects/twitter-trend/tests/integration)
- [`tests/e2e`](/Users/nicklocascio/Projects/twitter-trend/tests/e2e)
