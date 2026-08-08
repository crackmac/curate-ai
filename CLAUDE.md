# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run unit tests (Vitest)
npx drizzle-kit generate   # Generate migration from schema changes
npx drizzle-kit migrate    # Apply migrations to curate.db
npx drizzle-kit push       # Push schema directly (dev shortcut, skips migration files)
```

Unit tests use Vitest (`*.test.ts` colocated with source). Tests cover pure logic
only (no DB/network). CI (`.github/workflows/`) runs lint, tests, build, `npm audit`,
and CodeQL on pushes and PRs to `main`.

## Architecture

CurateAI is a Next.js 16 app that aggregates content from multiple sources, ranks it using a two-stage AI pipeline, and presents a personalized daily digest.

### Data flow

```
Sources → Ingest API → content_items table → Curation Pipeline → curated_items table → Digest UI
```

**Ingestion** (`POST /api/ingest`, optional `?category=` to scope to one category): Iterates enabled sources, calls the matching adapter, writes raw items to `content_items`. Triggered by in-process `node-cron` schedules — one ingest job and one curate job per row in the `categories` table (`src/lib/scheduler.ts`), not hardcoded.

**Curation** (`POST /api/curate`, optional `?category=` to scope to one category): Three-stage pipeline in `pipeline.ts`, run via `runCurationPipeline(userId, category?)`. It pulls the 400 most-recent embedded items (filtered to `category`'s sources when scoped), then Stage 1 ranks them by embedding cosine similarity against a time-decayed user interest vector and keeps the top `MAX_CANDIDATES` (100). If the user has no interest signal yet, Stage 1 is skipped and the 100 most-recent items are used. Stage 2 sends those to an LLM (Anthropic if `ANTHROPIC_API_KEY` is set, else Ollama — see Environment variables) for scoring, explanation, and reason tagging. Stage 3 assembles the digest: scores are boosted for cross-source items, then a diversity cap (`max(3, ceil(digestSize / uniqueSourceTypes))`) limits items per source type, with an overflow pass filling remaining slots. `digestSize` defaults to 20. A category-scoped run only deletes/rewrites that category's slice of `curated_items` for the day (safe: each category's content items are disjoint, so this never collides with another category's same-day rows). `generateMissingEmbeddings()` is also category-scoped when a category is given, so one category's embedding backlog can't starve another's. Triggered per-category by the `categories` table's `curateCron`.

**Serving** (`GET /api/content`, optional `?category=`): Returns today's curated digest, ordered by `position` when scoped to one category or by `score` descending for the "all" view (per-category curate runs can produce overlapping `position` values across categories). Falls back to round-robin recent content if no curation exists yet. `GET/POST/PATCH/DELETE /api/categories` is full CRUD over the `categories` table (see Categories below); `GET/POST /api/preferences/topic-scores` reads/updates per-topic affinity scores.

**Feedback** (`POST /api/interact`): Records a `click` / `save` / `dismiss` / `less_like_this` interaction against a content item. Saves and dismissals feed back into the interest vector and the LLM prompt's "recently saved / disliked" hints on the next curation run.

### Categories

Categories are a first-class table (`categories`: `slug`, `name`, `ingestCron`, `curateCron`), not a hardcoded list — unlimited custom categories can be created via Settings. `sources.category` is a free-text column referencing `categories.slug` by convention (no DB-level FK; SQLite can't add one to an existing column without a table rebuild, so the relationship is enforced at the API layer instead).

`src/lib/scheduler.ts`'s `reconcileSchedules()` reads the table and registers an ingest + curate `node-cron` job per row, tracking the created `ScheduledTask` handles so it can `.destroy()` and re-register them. `POST`/`PATCH`/`DELETE /api/categories` all call `reconcileSchedules()` after committing, so adding a category, editing its cadence, or renaming its slug takes effect immediately — no restart needed. Renaming a slug cascades to `sources.category`. Deleting a category still referenced by sources is blocked with `409` rather than cascading.

`CategoryManager.tsx` (Settings) manages categories; its cadence pickers are presets (`CADENCE_PRESETS` — "Every 4 hours", "Once daily", etc.) mapped to cron strings with stagger offsets baked in, not raw cron input, to avoid every category's jobs bursting on the same shared services (Reddit) or LLM provider at once.

### Source adapters

Each adapter in `src/lib/sources/` implements the `SourceAdapter` interface: an `id` string and a `fetch(config)` method returning `RawContentItem[]`. Adapters: `hackernews`, `reddit` (subreddit via config), `rss`, `youtube`, `bluesky`. Register new adapters in `src/lib/sources/index.ts`.

### Curation pipeline (`src/lib/curation/`)

- **embeddings.ts** — Lazy-loaded HuggingFace `all-MiniLM-L6-v2` model (384-dim vectors). Singleton extractor pattern; first call downloads the model.
- **similarity.ts** — Cosine similarity and time-decayed interest vector computation.
- **ranker.ts** — LLM ranking. Uses `ANTHROPIC_API_KEY` env var to choose Anthropic, otherwise falls back to Ollama (`OLLAMA_URL`, `OLLAMA_MODEL`).
- **pipeline.ts** — Orchestrates the full curation run for a user.

### Database

SQLite via `better-sqlite3` + Drizzle ORM. DB path is configured via `DATABASE_PATH` env var (defaults to `curate.db` at project root for local dev; `/data/curate.db` on Fly.io). Schema is in `src/lib/db/schema.ts`. WAL mode and foreign keys are enabled.

Key tables: `users`, `user_preferences` (JSON-encoded topics/content types), `categories` (slug/name/ingestCron/curateCron), `sources`, `user_sources` (per-user enable/disable), `content_items` (with blob `embedding` column), `curated_items` (scored/explained/positioned), `interactions` (click/save/dismiss/less_like_this).

The `seed()` function runs at server startup via `instrumentation.ts` to ensure default categories, default sources, and a local dev user exist (idempotent via `onConflictDoNothing`, with by-slug sync loops afterward for fields `onConflictDoNothing` won't update on existing rows).

### Frontend

- Client components using SWR for data fetching (`useDigest`, `useInteraction`, `useCategories` hooks).
- Two pages: `/` (digest grid with `CategoryTabs` filtering) and `/settings` (`CategoryManager` for categories, source management, plus `TopicManager` and `TopicScoreChart` for topic affinity).
- Tailwind CSS v4 with dark mode support.
- Icons from `lucide-react`.

### Single-user assumption

All API routes hardcode `USER_ID = 1`. Multi-user support is schema-ready but not wired up.

### Deployment

Hosted on Fly.io (`fly.toml`, region `lax`) as a single-machine deployment with a persistent volume `curate_data` mounted at `/data`. The `instrumentation.ts` `register()` hook runs on server boot (Node runtime only): it calls `runMigrations()`, then `seed()`, then `startScheduler()`. Docker image uses Next.js standalone output mode.

Note: `runMigrations()` (`src/lib/db/migrate.ts`) applies the Drizzle migrations in full *only if the `sources` table does not yet exist*. On an existing DB it doesn't re-run the migration set, but it still applies specific hand-coded idempotent backfills on every boot (e.g. `ALTER TABLE sources ADD COLUMN category`, `CREATE TABLE IF NOT EXISTS categories`). It does not apply new incremental Drizzle migrations to an existing DB — after changing the schema, add a matching hand-coded backfill here (for production) *and* run `npx drizzle-kit generate` (for fresh installs going through the real migration path).

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | No | Claude ranking if set; otherwise falls back to Ollama. **Intentionally unset in production** — this deployment uses Ollama's hosted cloud API instead (see below) |
| `OLLAMA_URL` | No (default `http://localhost:11434`) | Ollama endpoint — local server or a hosted API. Production uses `https://ollama.com` |
| `OLLAMA_MODEL` | No (default `llama3.1:8b`) | Ollama model name. Production uses `glm-5.2:cloud` — `llama3.1:8b` isn't on Ollama's hosted cloud fleet, which only serves frontier-scale models |
| `OLLAMA_API_KEY` | For hosted Ollama endpoints | Sent as `Authorization: Bearer` when set; omitted for unauthenticated local servers. `rankWithOllama` also sets `think: false` — cloud reasoning models otherwise spend their whole token budget on a hidden thinking trace before the JSON answer |
| `DATABASE_PATH` | No (default `./curate.db`) | SQLite database file path |
| `INTERNAL_URL` | No (default `http://localhost:3000`) | Base URL for scheduler self-calls |
| `YOUTUBE_API_KEY` | For YouTube source | YouTube Data API access |
| `REDDIT_USER_AGENT` | No | User-Agent header for Reddit `.rss` requests |
