import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sources, contentItems, userSources } from "@/lib/db/schema";
import { getAdapter } from "@/lib/sources";
import { fetchSubreddits } from "@/lib/sources/reddit";
import type { RawContentItem } from "@/lib/sources/types";
import { eq } from "drizzle-orm";

const USER_ID = 1;

// Minimum gap (ms) between consecutive fetches of the same source type, to
// stay under per-service rate limits. The ingest loop is already serial, so
// this only paces same-type calls; alternating types incur no extra wait.
// Reddit isn't listed: a Category's subreddits share one combined request,
// paced by Reddit's own rate-limit headers (see fetchSubreddits).
const THROTTLE_MS: Record<string, number> = {
  youtube: 1500,
  bluesky: 500,
  rss: 0,
  hackernews: 0,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

    const enabledSources = allSources.filter((source) => {
      const override = overrideMap.get(source.id);
      return override ? override.enabled === 1 : source.isDefault === 1;
    });

    // Reddit allows about one unauthenticated request a minute, so each
    // Category's enabled subreddit Sources are fetched together in one
    // request, made when the Category's first subreddit Source comes up.
    const subredditsByCategory = new Map<string, string[]>();
    for (const source of enabledSources) {
      if (source.type !== "reddit") continue;
      const subreddit = subredditOf(source.config);
      if (!subreddit) continue;
      const key = source.category ?? "";
      subredditsByCategory.set(key, [...(subredditsByCategory.get(key) ?? []), subreddit]);
    }
    const redditFetches = new Map<string, Promise<Map<string, RawContentItem[]>>>();
    const fetchReddit = (category: string) => {
      let pending = redditFetches.get(category);
      if (!pending) {
        pending = fetchSubreddits(subredditsByCategory.get(category) ?? []);
        redditFetches.set(category, pending);
      }
      return pending;
    };

    for (const source of enabledSources) {
      const adapter = getAdapter(source.type);
      if (!adapter) {
        skipped.push(`${source.slug}: no adapter for type "${source.type}"`);
        continue;
      }

      // Throttle: enforce the minimum gap since the last fetch of this type.
      const minGap = THROTTLE_MS[source.type] ?? 0;
      if (minGap > 0) {
        const waitMs = minGap - (Date.now() - (lastFetchByType[source.type] ?? 0));
        if (waitMs > 0) await sleep(waitMs);
      }
      lastFetchByType[source.type] = Date.now();

      try {
        const config = JSON.parse(source.config);
        const subreddit = source.type === "reddit" ? subredditOf(source.config) : undefined;
        const items = subreddit
          ? ((await fetchReddit(source.category ?? "")).get(subreddit) ?? [])
          : await adapter.fetch(config);

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
        errors.push(`${source.slug}: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    }

    return NextResponse.json({ ingested: totalIngested, errors, skipped, empty });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}

function subredditOf(config: string): string | undefined {
  try {
    const subreddit = (JSON.parse(config) as { subreddit?: unknown }).subreddit;
    return typeof subreddit === "string" && subreddit ? subreddit : undefined;
  } catch {
    return undefined;
  }
}
