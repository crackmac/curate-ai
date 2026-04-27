import { NextResponse } from "next/server";
import { seed } from "@/lib/db/seed";
import { runCurationPipeline } from "@/lib/curation/pipeline";

const USER_ID = 1;

export async function POST() {
  try {
    seed();
    const result = await runCurationPipeline(USER_ID);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}
