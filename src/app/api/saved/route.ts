import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentItems, interactions, sources } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { CuratedContentItem } from "@/types";

const USER_ID = 1;

// The Saved List: every currently Saved Content Item, newest Save first.
export async function GET() {
  try {
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
        sourceCategory: sources.category,
      })
      .from(interactions)
      .innerJoin(contentItems, eq(interactions.contentItemId, contentItems.id))
      .innerJoin(sources, eq(contentItems.sourceId, sources.id))
      .where(
        and(eq(interactions.userId, USER_ID), eq(interactions.type, "save")),
      )
      // Newest Save first. Ids follow insert order; created_at holds a literal default string, not a time.
      .orderBy(desc(interactions.id))
      .all();

    // Saved items aren't tied to a Digest, so they carry no score or Explanation.
    const items: CuratedContentItem[] = rows.map((row, index) => ({
      ...row,
      type: row.type as CuratedContentItem["type"],
      metadata: JSON.parse(row.metadata),
      score: 0,
      explanation: "",
      reason: "saved_similar",
      position: index,
      digestDate: "",
      saved: true,
      lessLikeThis: false,
    }));

    return NextResponse.json({ items, total: items.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 },
    );
  }
}
