import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { interactions } from "@/lib/db/schema";
import { STATE_TYPES } from "@/lib/db/feedback-history";
import { and, eq, inArray } from "drizzle-orm";

const USER_ID = 1;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contentItemId, type, active } = body;

    if (!contentItemId || !type) {
      return NextResponse.json(
        { error: "contentItemId and type are required" },
        { status: 400 }
      );
    }

    const validTypes = ["click", "save", "dismiss", "less_like_this"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `type must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Undo of a Dismiss: withdraw it so the item is no longer hidden.
    if (type === "dismiss" && active === false) {
      db.delete(interactions)
        .where(
          and(
            eq(interactions.userId, USER_ID),
            eq(interactions.contentItemId, contentItemId),
            eq(interactions.type, "dismiss")
          )
        )
        .run();
      return NextResponse.json({ success: true });
    }

    if (!STATE_TYPES.includes(type)) {
      db.insert(interactions)
        .values({ userId: USER_ID, contentItemId, type })
        .run();
      return NextResponse.json({ success: true });
    }

    if (typeof active !== "boolean") {
      return NextResponse.json(
        { error: `active (boolean) is required for ${type}` },
        { status: 400 }
      );
    }

    // Save and Less Like This are mutually exclusive states: clear any current
    // state for the item, then set the new one if it's being turned on.
    db.transaction((tx) => {
      tx.delete(interactions)
        .where(
          and(
            eq(interactions.userId, USER_ID),
            eq(interactions.contentItemId, contentItemId),
            active
              ? inArray(interactions.type, STATE_TYPES)
              : eq(interactions.type, type)
          )
        )
        .run();
      if (active) {
        tx.insert(interactions)
          .values({ userId: USER_ID, contentItemId, type })
          .run();
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}
