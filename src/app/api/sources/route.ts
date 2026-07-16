import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sources, userSources, contentItems, curatedItems, interactions } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

const USER_ID = 1;

export async function GET() {
  try {

    const allSources = db.select().from(sources).all();
    const overrides = db
      .select()
      .from(userSources)
      .where(eq(userSources.userId, USER_ID))
      .all();

    const overrideMap = new Map(overrides.map((o) => [o.sourceId, o]));

    const result = allSources.map((s) => {
      const override = overrideMap.get(s.id);
      return {
        id: s.id,
        slug: s.slug,
        name: s.name,
        type: s.type,
        url: s.url,
        description: s.description,
        isDefault: s.isDefault === 1,
        vetted: s.vetted === 1,
        enabled: override ? override.enabled === 1 : s.isDefault === 1,
        addedByUser: override?.addedByUser === 1,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceId, name, url, config, description } = body as {
      sourceId: number;
      name?: string;
      url?: string;
      config?: Record<string, unknown>;
      description?: string;
    };

    const existing = db.select().from(sources).where(eq(sources.id, sourceId)).get();
    if (!existing) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (url !== undefined) updates.url = url;
    if (config !== undefined) updates.config = JSON.stringify(config);
    if (description !== undefined) updates.description = description;

    if (name !== undefined) {
      updates.slug = `${existing.type}/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    }

    if (Object.keys(updates).length > 0) {
      db.update(sources).set(updates).where(eq(sources.id, sourceId)).run();
    }

    const updated = db.select().from(sources).where(eq(sources.id, sourceId)).get();
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceId = Number(searchParams.get("sourceId"));

    if (!sourceId) {
      return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
    }

    const contentIds = db
      .select({ id: contentItems.id })
      .from(contentItems)
      .where(eq(contentItems.sourceId, sourceId))
      .all()
      .map((r) => r.id);

    if (contentIds.length > 0) {
      db.delete(interactions)
        .where(inArray(interactions.contentItemId, contentIds))
        .run();
      db.delete(curatedItems)
        .where(inArray(curatedItems.contentItemId, contentIds))
        .run();
      db.delete(contentItems)
        .where(eq(contentItems.sourceId, sourceId))
        .run();
    }

    db.delete(userSources).where(eq(userSources.sourceId, sourceId)).run();
    db.delete(sources).where(eq(sources.id, sourceId)).run();

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { sourceId, enabled } = body as { sourceId: number; enabled: boolean };

    db.insert(userSources)
      .values({
        userId: USER_ID,
        sourceId,
        enabled: enabled ? 1 : 0,
      })
      .onConflictDoUpdate({
        target: [userSources.userId, userSources.sourceId],
        set: { enabled: enabled ? 1 : 0 },
      })
      .run();

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, type, url, config, description } = body as {
      name: string;
      type: string;
      url: string;
      config: Record<string, unknown>;
      description?: string;
    };

    const slug = `${type}/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    const result = db
      .insert(sources)
      .values({
        slug,
        name,
        type,
        url,
        config: JSON.stringify(config),
        isDefault: 0,
        vetted: 0,
        description: description ?? null,
      })
      .returning()
      .get();

    db.insert(userSources)
      .values({
        userId: USER_ID,
        sourceId: result.id,
        enabled: 1,
        addedByUser: 1,
      })
      .run();

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}
