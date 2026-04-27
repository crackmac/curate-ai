import { db } from "@/lib/db";
import {
  contentItems,
  curatedItems,
  interactions,
  userPreferences,
  sources,
} from "@/lib/db/schema";
import { eq, desc, and, isNull, isNotNull, inArray } from "drizzle-orm";
import {
  generateEmbedding,
  embeddingToBuffer,
  bufferToEmbedding,
} from "./embeddings";
import { rankBySimilarity, computeInterestVector } from "./similarity";
import { rankWithLLM, type RankedItem } from "./ranker";

const MAX_CANDIDATES = 60;

export async function runCurationPipeline(userId: number) {
  const today = new Date().toISOString().split("T")[0];

  // Clear any existing curation for today so we can re-curate
  db.delete(curatedItems)
    .where(and(eq(curatedItems.userId, userId), eq(curatedItems.digestDate, today)))
    .run();

  // 1. Generate embeddings for items that don't have them yet
  await generateMissingEmbeddings();

  // 2. Build user interest vector from positive interactions
  const interestVector = await buildInterestVector(userId);

  // 3. Get all content with embeddings
  const candidates = db
    .select({
      id: contentItems.id,
      title: contentItems.title,
      summary: contentItems.summary,
      type: contentItems.type,
      author: contentItems.author,
      embedding: contentItems.embedding,
      sourceId: contentItems.sourceId,
      sourceName: sources.name,
      sourceType: sources.type,
    })
    .from(contentItems)
    .innerJoin(sources, eq(contentItems.sourceId, sources.id))
    .where(isNotNull(contentItems.embedding))
    .orderBy(desc(contentItems.publishedAt))
    .limit(200)
    .all();

  if (candidates.length === 0) return { curated: 0 };

  // 4. Stage 1 — embedding similarity filter
  let topCandidates;
  const hasInterest = interestVector.some((v) => v !== 0);

  if (hasInterest) {
    const withEmbeddings = candidates.map((c) => ({
      ...c,
      embeddingVec: bufferToEmbedding(c.embedding as Buffer),
    }));

    const ranked = rankBySimilarity(
      withEmbeddings.map((c) => ({ id: c.id, embedding: c.embeddingVec })),
      interestVector
    );

    const topIds = new Set(
      ranked.slice(0, MAX_CANDIDATES).map((r) => r.id)
    );
    const similarityMap = new Map(ranked.map((r) => [r.id, r.similarity]));

    topCandidates = candidates
      .filter((c) => topIds.has(c.id))
      .map((c) => ({
        ...c,
        similarityScore: similarityMap.get(c.id) ?? 0,
      }));
  } else {
    topCandidates = candidates.slice(0, MAX_CANDIDATES).map((c) => ({
      ...c,
      similarityScore: 0.5,
    }));
  }

  // 5. Stage 2 — Claude ranking
  const prefs = db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .get();

  const userTopics: string[] = prefs ? JSON.parse(prefs.topics) : [];
  const digestSize: number = prefs?.digestSize ?? 20;

  const recentSaves = db
    .select({ title: contentItems.title })
    .from(interactions)
    .innerJoin(contentItems, eq(interactions.contentItemId, contentItems.id))
    .where(and(eq(interactions.userId, userId), eq(interactions.type, "save")))
    .orderBy(desc(interactions.createdAt))
    .limit(10)
    .all()
    .map((r) => r.title);

  const recentDislikes = db
    .select({ title: contentItems.title })
    .from(interactions)
    .innerJoin(contentItems, eq(interactions.contentItemId, contentItems.id))
    .where(
      and(
        eq(interactions.userId, userId),
        eq(interactions.type, "less_like_this")
      )
    )
    .orderBy(desc(interactions.createdAt))
    .limit(10)
    .all()
    .map((r) => r.title);

  let rankedItems;

  try {
    rankedItems = await rankWithLLM(
      topCandidates.map((c) => ({
        id: c.id,
        title: c.title,
        summary: c.summary,
        type: c.type,
        source: c.sourceName,
        author: c.author,
        similarityScore: c.similarityScore,
      })),
      userTopics,
      recentSaves,
      recentDislikes
    );
  } catch {
    rankedItems = topCandidates.map((c) => ({
      id: c.id,
      score: Math.round(c.similarityScore * 100),
      explanation: `Trending on ${c.sourceName}`,
      reason: "trending" as const,
    }));
  }

  // 6. Stage 3 — diversity-aware digest assembly
  const scoreMap = new Map(rankedItems.map((r) => [r.id, r]));
  const sourceCount = new Map<string, number>();
  const digest: { contentItemId: number; score: number; explanation: string; reason: string; position: number }[] = [];

  const uniqueSources = new Set(topCandidates.map((c) => c.sourceType));
  const maxPerSource = Math.max(3, Math.ceil(digestSize / uniqueSources.size));

  const defaultRanked = (id: number): RankedItem => ({
    id,
    score: 0,
    explanation: "",
    reason: "topic_match",
  });

  const sorted = topCandidates
    .map((c) => ({
      ...c,
      ranked: scoreMap.get(c.id) ?? defaultRanked(c.id),
    }))
    .sort((a, b) => b.ranked.score - a.ranked.score);

  for (const item of sorted) {
    if (digest.length >= digestSize) break;

    const count = sourceCount.get(item.sourceType) ?? 0;
    if (count >= maxPerSource) continue;

    digest.push({
      contentItemId: item.id,
      score: item.ranked.score,
      explanation: item.ranked.explanation,
      reason: item.ranked.reason,
      position: digest.length,
    });

    sourceCount.set(item.sourceType, count + 1);
  }

  // 7. Write to curated_items
  for (const entry of digest) {
    db.insert(curatedItems)
      .values({
        userId,
        contentItemId: entry.contentItemId,
        score: entry.score,
        explanation: entry.explanation,
        reason: entry.reason,
        digestDate: today,
        position: entry.position,
      })
      .onConflictDoNothing()
      .run();
  }

  return { curated: digest.length, date: today };
}

async function generateMissingEmbeddings() {
  const items = db
    .select({
      id: contentItems.id,
      title: contentItems.title,
      summary: contentItems.summary,
    })
    .from(contentItems)
    .where(isNull(contentItems.embedding))
    .limit(100)
    .all();

  for (const item of items) {
    const text = `${item.title}${item.summary ? `. ${item.summary}` : ""}`;
    const embedding = await generateEmbedding(text);

    db.update(contentItems)
      .set({ embedding: embeddingToBuffer(embedding) })
      .where(eq(contentItems.id, item.id))
      .run();
  }

  return items.length;
}

async function buildInterestVector(userId: number): Promise<Float32Array> {
  const positiveInteractions = db
    .select({ embedding: contentItems.embedding })
    .from(interactions)
    .innerJoin(contentItems, eq(interactions.contentItemId, contentItems.id))
    .where(
      and(
        eq(interactions.userId, userId),
        inArray(interactions.type, ["click", "save"]),
        isNotNull(contentItems.embedding)
      )
    )
    .orderBy(desc(interactions.createdAt))
    .limit(50)
    .all();

  if (positiveInteractions.length === 0) {
    return new Float32Array(384);
  }

  const embeddings = positiveInteractions.map((r) =>
    bufferToEmbedding(r.embedding as Buffer)
  );

  return computeInterestVector(embeddings);
}
