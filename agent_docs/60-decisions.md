# Decisions And Learnings

Use this file as the lightweight running log for architecture decisions, notable tradeoffs, and non-obvious lessons.

## How To Write Entries

Keep entries short and append-only.

Recommended format:

```md
## YYYY-MM-DD: Short title

- Context: what changed or what problem came up
- Decision: what was chosen
- Why: key reasoning or tradeoff
- Impact: what future agents/operators should assume now
- Follow-up: optional cleanup or future work
```

Only log things that future contributors are likely to need.

## Current Entries

## 2026-03-10: Agent docs added as a first-class repo navigation layer

- Context: the repo had product documentation in `README.md`, but no dedicated guide for coding agents to navigate the current architecture quickly.
- Decision: add a root [`AGENTS.md`](/Users/nicklocascio/Projects/twitter-trend/AGENTS.md) plus numbered docs under [`agent_docs/`](/Users/nicklocascio/Projects/twitter-trend/agent_docs).
- Why: the codebase mixes Next.js pages, CLI entrypoints, file-backed server modules, and runtime artifacts under `data/`; agents need a stable path to the right file without rediscovering structure each time.
- Impact: future changes should update these docs as part of the same task whenever architecture, workflows, or contracts move.
- Follow-up: if the repo grows more subsystems, split this file into an `agent_docs/adr/` folder or add more numbered deep-dive docs.

## 2026-03-10: Raw media keeps `.bin` compatibility copies but prefers native typed siblings

- Context: intercepted X media was often saved as `.bin` because many CDN URLs omit filename extensions, which made local files hard to inspect and reuse.
- Decision: write a `.bin` compatibility copy for persisted raw media, also write a native sibling when headers, URL hints, or file signatures identify the type, and store the native path in the manifest when available.
- Why: this preserves existing robustness and compatibility while giving operators usable `.jpg`, `.png`, `.webp`, `.gif`, `.mp4`, and `.m3u8` files.
- Impact: future capture changes should treat native-file creation as best-effort and keep bulk repair available through the raw-media backfill task.
- Follow-up: if capture starts transcoding or normalizing media bytes instead of copying them, extend the backfill path to record richer conversion metadata.
