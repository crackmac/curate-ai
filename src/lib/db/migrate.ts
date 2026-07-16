import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import path from "path";
import { db } from "./index";

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
    raw.close();
    return;
  }

  raw.close();

  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
}
