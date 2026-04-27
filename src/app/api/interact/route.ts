import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { interactions } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contentItemId, type } = body;

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

    db.insert(interactions)
      .values({ userId: 1, contentItemId, type })
      .run();

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}
