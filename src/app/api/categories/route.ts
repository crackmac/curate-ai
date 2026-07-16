import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sources } from "@/lib/db/schema";

export async function GET() {
  const rows = db.selectDistinct({ category: sources.category }).from(sources).all();
  const cats = rows
    .map((r) => r.category ?? "tech")
    .filter((c): c is string => Boolean(c));
  return NextResponse.json(["all", ...Array.from(new Set(cats)).sort()]);
}
