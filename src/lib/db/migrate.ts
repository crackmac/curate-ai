import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import path from "path";
import { db } from "./index";
import { resolveToggleHistory, type InteractionRow } from "./feedback-history";

export function runMigrations() {
  const dbPath =
    process.env.DATABASE_PATH || path.join(process.cwd(), "curate.db");
  const raw = new Database(dbPath);

  const tableExists = raw
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sources'"
    )
    .get();

  if (tableExists) {
    // Bootstrap already ran. Apply idempotent in-place column upgrades that the
    // bootstrap-only migrate() below never reaches on an existing DB.
    try {
      raw.exec("ALTER TABLE sources ADD COLUMN category TEXT DEFAULT 'tech'");
    } catch {
      // column already present
    }
    raw.exec(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      ingest_cron TEXT NOT NULL,
      curate_cron TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    convertToggleHistory(raw);
    raw.close();
    return;
  }

  raw.close();

  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
}

// Save and Less Like This used to be append-only (every toggle re-recorded
// the same Interaction). Collapse that history to current state, then let the
// unique index enforce one state per item. Idempotent: once collapsed, nothing
// is removed and the index already exists.
function convertToggleHistory(raw: Database.Database) {
  const indexExists = raw
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name='interaction_state_unique'",
    )
    .get();
  if (indexExists) return;

  raw.transaction(() => {
    const rows = raw
      .prepare(
        `SELECT id, content_item_id AS contentItemId, type, created_at AS createdAt
         FROM interactions WHERE type IN ('save', 'less_like_this')`,
      )
      .all() as InteractionRow[];
    const { remove } = resolveToggleHistory(rows);
    const del = raw.prepare("DELETE FROM interactions WHERE id = ?");
    for (const id of remove) del.run(id);
    raw.exec(
      `CREATE UNIQUE INDEX interaction_state_unique ON interactions (user_id, content_item_id)
       WHERE type IN ('save', 'less_like_this')`,
    );
    console.log(
      `[migrate] collapsed toggle history: removed ${remove.length} of ${rows.length} Save/Less Like This rows`,
    );
  })();
}
