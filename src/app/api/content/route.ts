import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentItems, curatedItems, sources } from "@/lib/db/schema";
import { desc, eq, and, gte, lt } from "drizzle-orm";
import type { CuratedContentItem } from "@/types";

const USER_ID = 1;
const FALLBACK_RECENT_DAYS = 7;
const FALLBACK_LIMIT = 30;

export async function GET(request: Request) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const categoryParam = new URL(request.url).searchParams.get("category");
    const category =
      categoryParam && categoryParam !== "all" ? categoryParam : null;

    // Try curated items first
    const curatedConds = [
      eq(curatedItems.userId, USER_ID),
      eq(curatedItems.digestDate, today),
    ];
    if (category) curatedConds.push(eq(sources.category, category));

    const curated = db
      .select({
        id: contentItems.id,
        sourceId: contentItems.sourceId,
        externalId: contentItems.externalId,
        type: contentItems.type,
        title: contentItems.title,
        summary: contentItems.summary,
        url: contentItems.url,
        author: contentItems.author,
        thumbnailUrl: contentItems.thumbnailUrl,
        metadata: contentItems.metadata,
        fetchedAt: contentItems.fetchedAt,
        publishedAt: contentItems.publishedAt,
        sourceName: sources.name,
        sourceType: sources.type,
        sourceSlug: sources.slug,
        sourceCategory: sources.category,
        score: curatedItems.score,
        explanation: curatedItems.explanation,
        reason: curatedItems.reason,
        position: curatedItems.position,
        digestDate: curatedItems.digestDate,
      })
      .from(curatedItems)
      .innerJoin(contentItems, eq(curatedItems.contentItemId, contentItems.id))
      .innerJoin(sources, eq(contentItems.sourceId, sources.id))
      .where(and(...curatedConds))
      .orderBy(category ? curatedItems.position : desc(curatedItems.score))
      .all();

    if (curated.length > 0) {
      const items: CuratedContentItem[] = curated.map((row) => ({
        ...row,
        type: row.type as CuratedContentItem["type"],
        reason: row.reason as CuratedContentItem["reason"],
        metadata: JSON.parse(row.metadata),
      }));

      return NextResponse.json({ items, date: today, total: items.length });
    }

    // Fallback: prefer recent rows first, with older backfill when needed.
    const recentCutoffIso = new Date(
      Date.now() - FALLBACK_RECENT_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const recentRows = db
      .select({
        id: contentItems.id,
        sourceId: contentItems.sourceId,
        externalId: contentItems.externalId,
        type: contentItems.type,
        title: contentItems.title,
        summary: contentItems.summary,
        url: contentItems.url,
        author: contentItems.author,
        thumbnailUrl: contentItems.thumbnailUrl,
        metadata: contentItems.metadata,
        fetchedAt: contentItems.fetchedAt,
        publishedAt: contentItems.publishedAt,
        sourceName: sources.name,
        sourceType: sources.type,
        sourceSlug: sources.slug,
        sourceCategory: sources.category,
      })
      .from(contentItems)
      .innerJoin(sources, eq(contentItems.sourceId, sources.id))
      .where(
        category
          ? and(
              eq(sources.category, category),
              gte(contentItems.publishedAt, recentCutoffIso),
            )
          : gte(contentItems.publishedAt, recentCutoffIso),
      )
      .orderBy(desc(contentItems.publishedAt))
      .limit(FALLBACK_LIMIT)
      .all();

    const olderRows =
      recentRows.length < FALLBACK_LIMIT
        ? db
            .select({
              id: contentItems.id,
              sourceId: contentItems.sourceId,
              externalId: contentItems.externalId,
              type: contentItems.type,
              title: contentItems.title,
              summary: contentItems.summary,
              url: contentItems.url,
              author: contentItems.author,
              thumbnailUrl: contentItems.thumbnailUrl,
              metadata: contentItems.metadata,
              fetchedAt: contentItems.fetchedAt,
              publishedAt: contentItems.publishedAt,
              sourceName: sources.name,
              sourceType: sources.type,
              sourceSlug: sources.slug,
              sourceCategory: sources.category,
            })
            .from(contentItems)
            .innerJoin(sources, eq(contentItems.sourceId, sources.id))
            .where(
              category
                ? and(
                    eq(sources.category, category),
                    lt(contentItems.publishedAt, recentCutoffIso),
                  )
                : lt(contentItems.publishedAt, recentCutoffIso),
            )
            .orderBy(desc(contentItems.publishedAt))
            .limit(FALLBACK_LIMIT - recentRows.length)
            .all()
        : [];

    const rows = [...recentRows, ...olderRows];

    const grouped = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = row.sourceType;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }

    const mixed: typeof rows = [];
    const iterators = [...grouped.values()].map((arr) => ({ arr, idx: 0 }));
    while (
      mixed.length < FALLBACK_LIMIT &&
      iterators.some((it) => it.idx < it.arr.length)
    ) {
      for (const it of iterators) {
        if (it.idx < it.arr.length && mixed.length < FALLBACK_LIMIT) {
          mixed.push(it.arr[it.idx++]);
        }
      }
    }

    const items: CuratedContentItem[] = mixed.map((row, index) => ({
      ...row,
      type: row.type as CuratedContentItem["type"],
      metadata: JSON.parse(row.metadata),
      score: 0,
      explanation: "Trending on " + row.sourceName,
      reason: "trending" as const,
      position: index,
      digestDate: today,
    }));

    return NextResponse.json({ items, date: today, total: items.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 },
    );
  }
}
