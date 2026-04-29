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

**Ingestion** (`POST /api/ingest`): Iterates enabled sources, calls the matching adapter, writes raw items to `content_items`. Triggered by Vercel cron every 4 hours.

**Curation** (`POST /api/curate`): Two-stage ranking pipeline. Stage 1 filters ~200 candidates to ~60 via embedding cosine similarity against a user interest vector. Stage 2 sends candidates to an LLM (Claude Haiku via Anthropic API, or Ollama fallback) for scoring, explanation, and reason tagging. A diversity pass caps items per source type before writing to `curated_items`. Triggered by Vercel cron daily at 6am.

**Serving** (`GET /api/content`): Returns today's curated digest. Falls back to round-robin recent content if no curation exists yet.

### Source adapters

Each adapter in `src/lib/sources/` implements the `SourceAdapter` interface: an `id` string and a `fetch(config)` method returning `RawContentItem[]`. Adapters: `hackernews`, `reddit`, `reddit` (subreddit via config), `rss`, `youtube`, `bluesky`. Register new adapters in `src/lib/sources/index.ts`.

### Curation pipeline (`src/lib/curation/`)

- **embeddings.ts** — Lazy-loaded HuggingFace `all-MiniLM-L6-v2` model (384-dim vectors). Singleton extractor pattern; first call downloads the model.
- **similarity.ts** — Cosine similarity and time-decayed interest vector computation.
- **ranker.ts** — LLM ranking. Uses `ANTHROPIC_API_KEY` env var to choose Anthropic, otherwise falls back to Ollama (`OLLAMA_URL`, `OLLAMA_MODEL`).
- **pipeline.ts** — Orchestrates the full curation run for a user.

### Database

SQLite via `better-sqlite3` + Drizzle ORM. The DB file is `curate.db` at project root (gitignored). Schema is in `src/lib/db/schema.ts`. WAL mode and foreign keys are enabled.

Key tables: `users`, `user_preferences` (JSON-encoded topics/content types), `sources`, `user_sources` (per-user enable/disable), `content_items` (with blob `embedding` column), `curated_items` (scored/explained/positioned), `interactions` (click/save/dismiss/less_like_this).

The `seed()` function runs on every API request to ensure default sources and a local dev user exist (idempotent via `onConflictDoNothing`).

### Frontend

- Client components using SWR for data fetching (`useDigest`, `useInteraction` hooks).
- Two pages: `/` (digest grid) and `/settings` (source management).
- Tailwind CSS v4 with dark mode support.
- Icons from `lucide-react`.

### Single-user assumption

All API routes hardcode `USER_ID = 1`. Multi-user support is schema-ready but not wired up.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | For AI curation | Claude Haiku ranking |
| `OLLAMA_URL` | No (default `localhost:11434`) | Local LLM fallback |
| `OLLAMA_MODEL` | No (default `llama3.1:8b`) | Ollama model name |
