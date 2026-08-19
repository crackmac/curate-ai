import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sources, contentItems, userSources } from "@/lib/db/schema";
import { getAdapter } from "@/lib/sources";
import { eq } from "drizzle-orm";

const USER_ID = 1;

// Minimum gap (ms) between consecutive fetches of the same source type, to
// stay under per-service rate limits. The ingest loop is already serial, so
// this only paces same-type calls; alternating types incur no extra wait.
const THROTTLE_MS: Record<string, number> = {
  reddit: 8000, // Reddit's .rss burst-limits are strict from server IPs
  youtube: 1500,
  bluesky: 500,
  rss: 0,
  hackernews: 0,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type ErrorSummary = {
  rateLimited: number;
  notFound: number;
  parse: number;
  other: number;
};

function summarizeErrors(errors: string[]): ErrorSummary {
  const summary: ErrorSummary = {
    rateLimited: 0,
    notFound: 0,
    parse: 0,
    other: 0,
  };

  for (const error of errors) {
    if (/\b429\b|rate limit/i.test(error)) {
      summary.rateLimited += 1;
      continue;
    }
    if (/\b404\b|not found/i.test(error)) {
      summary.notFound += 1;
      continue;
    }
    if (/parse|xml|constructor|invalid json/i.test(error)) {
      summary.parse += 1;
      continue;
    }
    summary.other += 1;
  }

  return summary;
}

export async function POST(request: Request) {
  try {
    const categoryParam = new URL(request.url).searchParams.get("category");
    const category =
      categoryParam && categoryParam !== "all" ? categoryParam : null;

    const allSources = category
      ? db.select().from(sources).where(eq(sources.category, category)).all()
      : db.select().from(sources).all();
    const overrides = db
      .select()
      .from(userSources)
      .where(eq(userSources.userId, USER_ID))
      .all();
    const overrideMap = new Map(overrides.map((o) => [o.sourceId, o]));

    let totalIngested = 0;
    const errors: string[] = [];
    const skipped: string[] = [];
    const empty: string[] = [];
    const lastFetchByType: Record<string, number> = {};

    for (const source of allSources) {
      const override = overrideMap.get(source.id);
      const enabled = override
        ? override.enabled === 1
        : source.isDefault === 1;
      if (!enabled) continue;

      const adapter = getAdapter(source.type);
      if (!adapter) {
        skipped.push(`${source.slug}: no adapter for type "${source.type}"`);
        continue;
      }

      // Throttle: enforce the minimum gap since the last fetch of this type.
      const minGap = THROTTLE_MS[source.type] ?? 0;
      if (minGap > 0) {
        const waitMs =
          minGap - (Date.now() - (lastFetchByType[source.type] ?? 0));
        if (waitMs > 0) await sleep(waitMs);
      }
      lastFetchByType[source.type] = Date.now();

      try {
        const config = JSON.parse(source.config);
        const items = await adapter.fetch(config);

        if (items.length === 0) empty.push(source.slug);

        for (const item of items) {
          db.insert(contentItems)
            .values({
              sourceId: source.id,
              externalId: item.externalId,
              type: item.type,
              title: item.title,
              summary: item.summary ?? null,
              url: item.url,
              author: item.author ?? null,
              thumbnailUrl: item.thumbnailUrl ?? null,
              metadata: JSON.stringify(item.metadata),
              publishedAt: item.publishedAt ?? null,
            })
            .onConflictDoNothing()
            .run();
          totalIngested++;
        }
      } catch (err) {
        errors.push(
          `${source.slug}: ${err instanceof Error ? err.message : "unknown error"}`,
        );
      }
    }

    const errorSummary = summarizeErrors(errors);
    console.log(
      `[ingest] ingested=${totalIngested} errors=${errors.length} skipped=${skipped.length} empty=${empty.length} rate_limited=${errorSummary.rateLimited} not_found=${errorSummary.notFound} parse=${errorSummary.parse} other=${errorSummary.other}`,
    );

    return NextResponse.json({
      ingested: totalIngested,
      errors,
      errorSummary,
      skipped,
      empty,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 },
    );
  }
}
