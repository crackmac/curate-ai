# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npx drizzle-kit generate   # Generate migration from schema changes
npx drizzle-kit migrate    # Apply migrations to curate.db
npx drizzle-kit push       # Push schema directly (dev shortcut, skips migration files)
```

No test framework is configured yet.

## Architecture

CurateAI is a Next.js 16 app that aggregates content from multiple sources, ranks it using a two-stage AI pipeline, and presents a personalized daily digest.

### Data flow

```
Sources → Ingest API → content_items table → Curation Pipeline → curated_items table → Digest UI
```

**Ingestion** (`POST /api/ingest`): Iterates enabled sources, calls the matching adapter, writes raw items to `content_items`. Triggered by in-process `node-cron` scheduler every 4 hours.

**Curation** (`POST /api/curate`): Three-stage pipeline in `pipeline.ts`. It pulls the 400 most-recent embedded items, then Stage 1 ranks them by embedding cosine similarity against a time-decayed user interest vector and keeps the top `MAX_CANDIDATES` (100). If the user has no interest signal yet, Stage 1 is skipped and the 100 most-recent items are used. Stage 2 sends those to an LLM (Claude Haiku `claude-haiku-4-5-20251001` via Anthropic API, else Ollama fallback) for scoring, explanation, and reason tagging. Stage 3 assembles the digest: scores are boosted for cross-source items, then a diversity cap (`max(3, ceil(digestSize / uniqueSourceTypes))`) limits items per source type, with an overflow pass filling remaining slots. `digestSize` defaults to 20. Triggered by the `node-cron` scheduler daily at 6am UTC.

**Serving** (`GET /api/content`): Returns today's curated digest. Falls back to round-robin recent content if no curation exists yet.

**Feedback** (`POST /api/interact`): Records a `click` / `save` / `dismiss` / `less_like_this` interaction against a content item. Saves and dismissals feed back into the interest vector and the LLM prompt's "recently saved / disliked" hints on the next curation run.

### Source adapters

Each adapter in `src/lib/sources/` implements the `SourceAdapter` interface: an `id` string and a `fetch(config)` method returning `RawContentItem[]`. Adapters: `hackernews`, `reddit`, `reddit` (subreddit via config), `rss`, `youtube`, `bluesky`. Register new adapters in `src/lib/sources/index.ts`.

### Curation pipeline (`src/lib/curation/`)

- **embeddings.ts** — Lazy-loaded HuggingFace `all-MiniLM-L6-v2` model (384-dim vectors). Singleton extractor pattern; first call downloads the model.
- **similarity.ts** — Cosine similarity and time-decayed interest vector computation.
- **ranker.ts** — LLM ranking. Uses `ANTHROPIC_API_KEY` env var to choose Anthropic, otherwise falls back to Ollama (`OLLAMA_URL`, `OLLAMA_MODEL`).
- **pipeline.ts** — Orchestrates the full curation run for a user.

### Database

SQLite via `better-sqlite3` + Drizzle ORM. DB path is configured via `DATABASE_PATH` env var (defaults to `curate.db` at project root for local dev; `/data/curate.db` on Fly.io). Schema is in `src/lib/db/schema.ts`. WAL mode and foreign keys are enabled.

Key tables: `users`, `user_preferences` (JSON-encoded topics/content types), `sources`, `user_sources` (per-user enable/disable), `content_items` (with blob `embedding` column), `curated_items` (scored/explained/positioned), `interactions` (click/save/dismiss/less_like_this).

The `seed()` function runs at server startup via `instrumentation.ts` to ensure default sources and a local dev user exist (idempotent via `onConflictDoNothing`).

### Frontend

- Client components using SWR for data fetching (`useDigest`, `useInteraction` hooks).
- Two pages: `/` (digest grid) and `/settings` (source management).
- Tailwind CSS v4 with dark mode support.
- Icons from `lucide-react`.

### Single-user assumption

All API routes hardcode `USER_ID = 1`. Multi-user support is schema-ready but not wired up.

### Deployment

Hosted on Fly.io (`fly.toml`, region `lax`) as a single-machine deployment with a persistent volume `curate_data` mounted at `/data`. The `instrumentation.ts` `register()` hook runs on server boot (Node runtime only): it calls `runMigrations()`, then `seed()`, then `startScheduler()`. Docker image uses Next.js standalone output mode.

Note: `runMigrations()` is bootstrap-only — it applies the Drizzle migrations *only if the `sources` table does not yet exist*, then no-ops on every subsequent boot. It does not apply incremental migrations to an existing DB. After changing the schema, apply migrations manually (`npx drizzle-kit migrate` or `push`) — a running instance will not pick them up on restart.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | For AI curation | Claude Haiku ranking |
| `OLLAMA_URL` | No (default `localhost:11434`) | Local LLM fallback |
| `OLLAMA_MODEL` | No (default `llama3.1:8b`) | Ollama model name |
| `DATABASE_PATH` | No (default `./curate.db`) | SQLite database file path |
| `INTERNAL_URL` | No (default `http://localhost:3000`) | Base URL for scheduler self-calls |
