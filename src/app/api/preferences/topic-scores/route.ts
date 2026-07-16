import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateEmbedding } from "@/lib/curation/embeddings";
import { cosineSimilarity } from "@/lib/curation/similarity";
import { buildInterestVector } from "@/lib/curation/pipeline";

const USER_ID = 1;

export async function GET() {
  try {
    const prefs = db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, USER_ID))
      .get();
    const topics: string[] = prefs ? JSON.parse(prefs.topics) : [];

    const interest = await buildInterestVector(USER_ID);
    const hasInterest = interest.some((v) => v !== 0);

    if (!hasInterest) {
      return NextResponse.json({
        scores: topics.map((topic) => ({ topic, score: 0 })),
        cold: true,
      });
    }

    const scores: { topic: string; score: number }[] = [];
    for (const topic of topics) {
      const emb = await generateEmbedding(topic);
      const sim = Math.max(0, cosineSimilarity(emb, interest));
      scores.push({ topic, score: Math.round(sim * 100) });
    }
    scores.sort((a, b) => b.score - a.score);

    return NextResponse.json({ scores, cold: false });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}
