import { NextResponse } from "next/server";
import { runCurationPipeline } from "@/lib/curation/pipeline";

const USER_ID = 1;

export async function POST(request: Request) {
  try {
    const categoryParam = new URL(request.url).searchParams.get("category");
    const category = categoryParam && categoryParam !== "all" ? categoryParam : undefined;
    const result = await runCurationPipeline(USER_ID, category);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}
