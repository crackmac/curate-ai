# CurateAI

CurateAI is a Next.js 16 app that ingests content from multiple sources, ranks it in a multi-stage curation pipeline, and serves a daily digest by category.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Common Commands

```bash
npm run dev
npm run build
npm run lint
npm test
```

## Build and Runtime Notes

- The default production build uses webpack for stability: `next build --webpack`.
- The app uses local Geist package imports (not Google font fetch at build-time).
- SQLite uses `better-sqlite3`; Linux build images need `python3`, `make`, and `g++` available for native module builds.

## Deployment Notes (Fly.io)

- `DATABASE_PATH` should target persistent storage (`/data/curate.db` in Fly).
- Keep stale local dependency folders out of Docker context (`.dockerignore`) to prevent slow/failed deploy uploads.
- If deployment fails in dependency install stage, verify native build prerequisites for `better-sqlite3` are installed in the Docker deps stage.

## Curation Freshness Strategy (Current)

- Interest vector weighting favors newer user interactions.
- Candidate selection is recent-first (7-day window) with older-content backfill when recent volume is low.
- Final ranking applies a freshness multiplier so stale items are less likely to dominate.

## Ingest Resilience (Current)

- Source fetches are throttled by provider type.
- Reddit and YouTube requests retry with backoff on rate-limit/transient failures.
- BlueSky 400 responses are treated as empty source results.
- RSS parsing includes fallback handling for malformed feeds and 404 feeds.
- Ingest API response includes `errorSummary` with: `rateLimited`, `notFound`, `parse`, `other`.

## Where to Look Next

- `src/lib/curation/` for ranking, embeddings, and pipeline logic.
- `src/lib/sources/` for source adapters and ingest behavior.
- `src/app/api/` for ingest, curate, and content serving routes.
