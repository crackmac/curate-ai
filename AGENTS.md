<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CurateAI

Single-user Next.js 16 app: aggregates content from source adapters, ranks it with a two-stage AI pipeline (embeddings → LLM), serves a daily digest. Detailed architecture notes (data flow, pipeline stages, categories, deployment) live in `CLAUDE.md` — read it before touching `src/lib/`.

## Commands

```bash
npm run dev        # dev server on :3000
npm run lint
npm test           # vitest run
npm run build      # note: webpack (--webpack flag), NOT Turbopack; build:turbopack is the Turbopack variant
npx vitest run src/lib/curation/similarity.test.ts   # single test file
```

CI (`.github/workflows/`) runs lint → test → build on pushes/PRs to `main`, plus non-blocking `npm audit` and CodeQL.

## Gotchas

- **Schema changes have a dual migration path.** `runMigrations()` (`src/lib/db/migrate.ts`, runs on boot via `instrumentation.ts`) applies the full Drizzle migration set *only if the `sources` table doesn't exist*. On an existing DB it only runs hand-coded idempotent backfills. So after changing `src/lib/db/schema.ts`: run `npx drizzle-kit generate` (fresh installs) **and** add a matching hand-coded backfill in `migrate.ts` (existing DBs, including production).
- **Scheduler is in-process `node-cron`**, one ingest + one curate job per row in the `categories` table (`src/lib/scheduler.ts`). Category CRUD routes call `reconcileSchedules()` so changes apply without restart — keep that call when adding new category mutations.
- **All API routes hardcode `USER_ID = 1`.** Multi-user is schema-ready but not wired up.
- **LLM ranking falls back by env**: Anthropic if `ANTHROPIC_API_KEY` is set, else Ollama (`OLLAMA_URL`, `OLLAMA_MODEL`, `OLLAMA_API_KEY`). Production intentionally uses hosted Ollama (`glm-5.2:cloud`), not Anthropic.
- **Embeddings use a lazy-loaded local `all-MiniLM-L6-v2` model** (via `@huggingface/transformers` → onnxruntime-node). `next.config.ts` `outputFileTracingIncludes` hand-copies onnxruntime binaries for `/api/curate` and `/api/preferences/topic-scores` — update it if another route needs embeddings or native deps.
- **Tests are pure-logic only** (`src/**/*.test.ts`, colocated, node environment): no DB, no network. Don't write tests that hit SQLite or fetch.
- SQLite via `better-sqlite3` + Drizzle; DB file at `DATABASE_PATH` (default `./curate.db` at repo root — it's a real dev database with data, don't delete or commit changes to it). WAL mode + foreign keys enabled.
- `sources.category` references `categories.slug` by convention only — no DB FK (SQLite can't add one without a table rebuild); enforce at the API layer.

## Conventions

- Source adapters live in `src/lib/sources/`, implement `SourceAdapter` (`id` + `fetch(config)`), and must be registered in `src/lib/sources/index.ts`.
- Frontend: App Router, client components fetching via SWR hooks (`src/hooks/`), Tailwind CSS v4, icons from `lucide-react`.
