import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { categories, sources } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { reconcileSchedules } from "@/lib/scheduler";

export async function GET() {
  const rows = db.select().from(categories).all();
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, name, ingestCron, curateCron } = body as {
      slug: string;
      name: string;
      ingestCron: string;
      curateCron: string;
    };

    const result = db
      .insert(categories)
      .values({ slug, name, ingestCron, curateCron })
      .returning()
      .get();

    reconcileSchedules();

    return NextResponse.json(result, { status: 201 });
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
    const { id, name, slug, ingestCron, curateCron } = body as {
      id: number;
      name?: string;
      slug?: string;
      ingestCron?: string;
      curateCron?: string;
    };

    const existing = db.select().from(categories).where(eq(categories.id, id)).get();
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    if (slug !== undefined && slug !== existing.slug) {
      db.update(sources).set({ category: slug }).where(eq(sources.category, existing.slug)).run();
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (slug !== undefined) updates.slug = slug;
    if (ingestCron !== undefined) updates.ingestCron = ingestCron;
    if (curateCron !== undefined) updates.curateCron = curateCron;

    if (Object.keys(updates).length > 0) {
      db.update(categories).set(updates).where(eq(categories.id, id)).run();
    }

    const updated = db.select().from(categories).where(eq(categories.id, id)).get();

    reconcileSchedules();

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
    const id = Number(searchParams.get("id"));

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = db.select().from(categories).where(eq(categories.id, id)).get();
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const sourceCount = db
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.category, existing.slug))
      .all().length;

    if (sourceCount > 0) {
      return NextResponse.json(
        { error: `${sourceCount} sources use this category`, sourceCount },
        { status: 409 }
      );
    }

    db.delete(categories).where(eq(categories.id, id)).run();

    reconcileSchedules();

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}
