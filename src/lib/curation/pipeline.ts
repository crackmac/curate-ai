import { db } from "@/lib/db";
import {
  contentItems,
  curatedItems,
  interactions,
  userPreferences,
  sources,
} from "@/lib/db/schema";
import { eq, desc, and, isNull, isNotNull, inArray, gte } from "drizzle-orm";
import {
  generateEmbedding,
  embeddingToBuffer,
  bufferToEmbedding,
} from "./embeddings";
import { rankBySimilarity, computeInterestVector } from "./similarity";
import { rankWithLLM, type RankedItem } from "./ranker";

const MAX_CANDIDATES = 100;

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
    .limit(400)
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

  // 4b. Cross-source signal detection
  const crossSourceMap = detectCrossSourceSignals(topCandidates.map((c) => c.id));

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
        crossSourceCount: crossSourceMap.get(c.id) ?? 1,
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
    .map((c) => {
      const ranked = scoreMap.get(c.id) ?? defaultRanked(c.id);
      const crossCount = crossSourceMap.get(c.id) ?? 1;
      const boostedScore = Math.round(ranked.score * (1 + 0.15 * (crossCount - 1)));
      return { ...c, ranked, boostedScore };
    })
    .sort((a, b) => b.boostedScore - a.boostedScore);

  const usedIds = new Set<number>();

  for (const item of sorted) {
    if (digest.length >= digestSize) break;

    const count = sourceCount.get(item.sourceType) ?? 0;
    if (count >= maxPerSource) continue;

    digest.push({
      contentItemId: item.id,
      score: item.boostedScore,
      explanation: item.ranked.explanation,
      reason: item.ranked.reason,
      position: digest.length,
    });

    usedIds.add(item.id);
    sourceCount.set(item.sourceType, count + 1);
  }

  // Fill remaining slots from any source type (overflow pass)
  for (const item of sorted) {
    if (digest.length >= digestSize) break;
    if (usedIds.has(item.id)) continue;

    digest.push({
      contentItemId: item.id,
      score: item.boostedScore,
      explanation: item.ranked.explanation,
      reason: item.ranked.reason,
      position: digest.length,
    });
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
    .limit(500)
    .all();

  const BATCH_SIZE = 10;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (item) => {
        const text = `${item.title}${item.summary ? `. ${item.summary}` : ""}`;
        const embedding = await generateEmbedding(text);
        db.update(contentItems)
          .set({ embedding: embeddingToBuffer(embedding) })
          .where(eq(contentItems.id, item.id))
          .run();
      })
    );
  }

  return items.length;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function titlesMatchFuzzy(a: string, b: string): boolean {
  const wordsA = a.split(" ");
  const wordsB = b.split(" ");
  for (let i = 0; i <= wordsA.length - 3; i++) {
    const trigram = wordsA.slice(i, i + 3).join(" ");
    if (wordsB.length >= 3 && b.includes(trigram)) return true;
  }
  return false;
}

function detectCrossSourceSignals(candidateIds: number[]): Map<number, number> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const recentItems = db
    .select({
      id: contentItems.id,
      title: contentItems.title,
      sourceId: contentItems.sourceId,
    })
    .from(contentItems)
    .where(gte(contentItems.publishedAt, cutoff))
    .all();

  const candidateSet = new Set(candidateIds);
  const groups: { ids: number[]; sourceIds: Set<number> }[] = [];

  for (const item of recentItems) {
    const norm = normalizeTitle(item.title);
    let matched = false;
    for (const group of groups) {
      const representative = normalizeTitle(
        recentItems.find((r) => r.id === group.ids[0])!.title
      );
      if (titlesMatchFuzzy(norm, representative)) {
        group.ids.push(item.id);
        group.sourceIds.add(item.sourceId);
        matched = true;
        break;
      }
    }
    if (!matched) {
      groups.push({ ids: [item.id], sourceIds: new Set([item.sourceId]) });
    }
  }

  const result = new Map<number, number>();
  for (const group of groups) {
    if (group.sourceIds.size < 2) continue;
    for (const id of group.ids) {
      if (candidateSet.has(id)) {
        result.set(id, group.sourceIds.size);
      }
    }
  }
  return result;
}

export async function buildInterestVector(userId: number): Promise<Float32Array> {
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
