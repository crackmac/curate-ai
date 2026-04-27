import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentItems, curatedItems, sources } from "@/lib/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { seed } from "@/lib/db/seed";
import type { CuratedContentItem } from "@/types";

const USER_ID = 1;

export async function GET() {
  try {
    seed();

    const today = new Date().toISOString().split("T")[0];

    // Try curated items first
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
        score: curatedItems.score,
        explanation: curatedItems.explanation,
        reason: curatedItems.reason,
        position: curatedItems.position,
        digestDate: curatedItems.digestDate,
      })
      .from(curatedItems)
      .innerJoin(contentItems, eq(curatedItems.contentItemId, contentItems.id))
      .innerJoin(sources, eq(contentItems.sourceId, sources.id))
      .where(
        and(eq(curatedItems.userId, USER_ID), eq(curatedItems.digestDate, today))
      )
      .orderBy(curatedItems.position)
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

    // Fallback: round-robin mix of recent content
    const rows = db
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
      })
      .from(contentItems)
      .innerJoin(sources, eq(contentItems.sourceId, sources.id))
      .orderBy(desc(contentItems.publishedAt))
      .all();

    const grouped = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = row.sourceType;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }

    const mixed: typeof rows = [];
    const iterators = [...grouped.values()].map((arr) => ({ arr, idx: 0 }));
    while (mixed.length < 30 && iterators.some((it) => it.idx < it.arr.length)) {
      for (const it of iterators) {
        if (it.idx < it.arr.length && mixed.length < 30) {
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
      { status: 500 }
    );
  }
}
