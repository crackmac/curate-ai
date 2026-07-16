export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runMigrations } = await import("./lib/db/migrate");
    runMigrations();

    const { seed } = await import("./lib/db/seed");
    seed();

    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
  }
}
