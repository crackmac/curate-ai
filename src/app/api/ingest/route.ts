import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sources, contentItems, userSources } from "@/lib/db/schema";
import { getAdapter } from "@/lib/sources";
import { eq } from "drizzle-orm";

const USER_ID = 1;

export async function POST() {
  try {

    const allSources = db.select().from(sources).all();
    const overrides = db
      .select()
      .from(userSources)
      .where(eq(userSources.userId, USER_ID))
      .all();
    const overrideMap = new Map(overrides.map((o) => [o.sourceId, o]));

    let totalIngested = 0;
    const errors: string[] = [];

    for (const source of allSources) {
      const override = overrideMap.get(source.id);
      const enabled = override ? override.enabled === 1 : source.isDefault === 1;
      if (!enabled) continue;

      const adapter = getAdapter(source.type);
      if (!adapter) continue;

      try {
        const config = JSON.parse(source.config);
        const items = await adapter.fetch(config);

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

    return NextResponse.json({ ingested: totalIngested, errors });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}
