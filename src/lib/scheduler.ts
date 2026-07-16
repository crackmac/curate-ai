import cron from "node-cron";
import { db } from "@/lib/db";
import { sources } from "@/lib/db/schema";

// Per-category ingest cadence. Staggered minute offsets keep categories from
// bursting at the same instant (spreads load on shared services like Reddit).
// Categories not listed here fall back to DEFAULT_INGEST_CRON.
const INGEST_SCHEDULES: Record<string, string> = {
  tech: "0 */4 * * *", // every 4h on the hour
  sports: "15 */6 * * *", // every 6h at :15
  entertainment: "30 */12 * * *", // every 12h at :30
};
const DEFAULT_INGEST_CRON = "45 */4 * * *";

function ingestCategory(baseUrl: string, category: string) {
  return async () => {
    try {
      console.log(`[scheduler] Running ingest (${category})...`);
      const res = await fetch(
        `${baseUrl}/api/ingest?category=${encodeURIComponent(category)}`,
        { method: "POST" }
      );
      const data = await res.json();
      console.log(`[scheduler] Ingest (${category}) complete:`, data);
    } catch (err) {
      console.error(`[scheduler] Ingest (${category}) failed:`, err);
    }
  };
}

export function startScheduler() {
  const baseUrl = process.env.INTERNAL_URL || "http://localhost:3000";

  const categories = db
    .selectDistinct({ category: sources.category })
    .from(sources)
    .all()
    .map((r) => r.category ?? "tech");
  const uniqueCategories = Array.from(new Set(categories));

  for (const category of uniqueCategories) {
    const schedule = INGEST_SCHEDULES[category] ?? DEFAULT_INGEST_CRON;
    cron.schedule(schedule, ingestCategory(baseUrl, category));
  }

  cron.schedule("0 6 * * *", async () => {
    try {
      console.log("[scheduler] Running curation...");
      const res = await fetch(`${baseUrl}/api/curate`, { method: "POST" });
      const data = await res.json();
      console.log("[scheduler] Curation complete:", data);
    } catch (err) {
      console.error("[scheduler] Curation failed:", err);
    }
  });

  console.log(
    `[scheduler] Cron jobs registered: ingest per category [${uniqueCategories.join(
      ", "
    )}], curate (daily 6am UTC)`
  );
}
