# Single machine, SQLite, and an in-process scheduler

CurateAI runs as one Fly.io machine with SQLite on a mounted volume (`/data/curate.db`), and schedules Ingest Runs and Curation Runs with in-process `node-cron` rather than an external queue or cron service. For a single-user app this keeps hosting cheap and the system to one process with no extra infrastructure; we accept that it cannot scale out.

## Consequences

- **Never run more than one machine.** A second machine would register every Category's schedules again, running each Ingest and Curation Run twice, and would get its own volume, splitting the database.
- **The machine must stay up for schedules to fire.** `fly.toml` sets `min_machines_running = 1`, so `auto_stop_machines` never takes it to zero; lowering that silently stops all scheduled runs.
- Moving to multiple machines means replacing both pieces together: a shared database (e.g. Postgres) and a scheduler that runs each job once (an external cron or a job queue with locking).
