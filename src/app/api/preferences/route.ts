import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const USER_ID = 1;

export async function GET() {
  try {
    const prefs = db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, USER_ID))
      .get();

    if (!prefs) {
      return NextResponse.json({ topics: [], contentTypes: [], digestSize: 20 });
    }

    return NextResponse.json({
      topics: JSON.parse(prefs.topics),
      contentTypes: JSON.parse(prefs.contentTypes),
      digestSize: prefs.digestSize,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      topics?: string[];
      contentTypes?: string[];
      digestSize?: number;
    };

    const updates: Record<string, unknown> = {
      updatedAt: "(datetime('now'))",
    };
    if (body.topics !== undefined) updates.topics = JSON.stringify(body.topics);
    if (body.contentTypes !== undefined)
      updates.contentTypes = JSON.stringify(body.contentTypes);
    if (body.digestSize !== undefined) updates.digestSize = body.digestSize;

    db.update(userPreferences)
      .set(updates)
      .where(eq(userPreferences.userId, USER_ID))
      .run();

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}
