import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import path from "path";

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
    raw.close();
    return;
  }

  raw.close();

  const { db } = require("./index");
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
}
