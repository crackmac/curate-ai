import cron from "node-cron";

export function startScheduler() {
  const baseUrl = process.env.INTERNAL_URL || "http://localhost:3000";

  cron.schedule("0 */4 * * *", async () => {
    try {
      console.log("[scheduler] Running ingest...");
      const res = await fetch(`${baseUrl}/api/ingest`, { method: "POST" });
      const data = await res.json();
      console.log("[scheduler] Ingest complete:", data);
    } catch (err) {
      console.error("[scheduler] Ingest failed:", err);
    }
  });

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
    "[scheduler] Cron jobs registered: ingest (every 4h), curate (daily 6am UTC)"
  );
}
