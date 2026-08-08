import cron, { type ScheduledTask } from "node-cron";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";

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

function curateCategory(baseUrl: string, category: string) {
  return async () => {
    try {
      console.log(`[scheduler] Running curate (${category})...`);
      const res = await fetch(
        `${baseUrl}/api/curate?category=${encodeURIComponent(category)}`,
        { method: "POST" }
      );
      const data = await res.json();
      console.log(`[scheduler] Curate (${category}) complete:`, data);
    } catch (err) {
      console.error(`[scheduler] Curate (${category}) failed:`, err);
    }
  };
}

let scheduledTasks: ScheduledTask[] = [];

export function reconcileSchedules(
  baseUrl = process.env.INTERNAL_URL || "http://localhost:3000"
) {
  for (const task of scheduledTasks) task.destroy();

  const cats = db.select().from(categories).all();
  scheduledTasks = cats.flatMap((cat) => [
    cron.schedule(cat.ingestCron, ingestCategory(baseUrl, cat.slug)),
    cron.schedule(cat.curateCron, curateCategory(baseUrl, cat.slug)),
  ]);

  console.log(
    `[scheduler] Registered ${cats.length} categories [${cats
      .map((c) => c.slug)
      .join(", ")}]: ingest+curate crons`
  );
}

export function startScheduler() {
  reconcileSchedules();
}
