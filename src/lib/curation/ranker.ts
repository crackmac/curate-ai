import Anthropic from "@anthropic-ai/sdk";

interface CandidateForRanking {
  id: number;
  title: string;
  summary: string | null;
  type: string;
  source: string;
  author: string | null;
  publishedAt: string;
  similarityScore: number;
  crossSourceCount?: number;
}

export type ReasonTag =
  | "topic_match"
  | "trending"
  | "saved_similar"
  | "high_engagement"
  | "breaking"
  | "deep_dive"
  | "community_pick"
  | "broadening";

export interface RankedItem {
  id: number;
  score: number;
  explanation: string;
  reason: ReasonTag;
}

const VALID_REASONS = new Set<ReasonTag>([
  "topic_match",
  "trending",
  "saved_similar",
  "high_engagement",
  "breaking",
  "deep_dive",
  "community_pick",
  "broadening",
]);

function buildPrompt(
  candidates: CandidateForRanking[],
  userTopics: string[],
  recentSaves: string[],
  recentDislikes: string[],
): string {
  const now = Date.now();
  const candidateList = candidates
    .map(
      (c, i) =>
        `${i + 1}. [ID:${c.id}] "${c.title}" (${c.type} from ${c.source}, similarity: ${c.similarityScore.toFixed(2)}, age: ${Math.max(0, Math.floor((now - new Date(c.publishedAt).getTime()) / (24 * 60 * 60 * 1000)))}d${c.crossSourceCount && c.crossSourceCount > 1 ? `, appeared in ${c.crossSourceCount} sources` : ""})${c.summary ? `\n   ${c.summary.slice(0, 150)}` : ""}`,
    )
    .join("\n");

  return `You are a content curator. Score and explain each candidate for a personalized daily digest.

User interests: ${userTopics.join(", ")}
${recentSaves.length > 0 ? `Recently saved: ${recentSaves.slice(0, 5).join("; ")}` : ""}
${recentDislikes.length > 0 ? `Disliked (show less like these): ${recentDislikes.slice(0, 5).join("; ")}` : ""}

Candidates:
${candidateList}

For each candidate, provide:
- score: 0-100 (how relevant and valuable for this user)
- reason: exactly one of these tags: "topic_match" (matches stated interests), "trending" (hot right now across communities), "saved_similar" (similar to content they saved), "high_engagement" (lots of upvotes/likes/comments), "breaking" (breaking news or major announcement), "deep_dive" (in-depth technical or analytical piece), "community_pick" (popular in a specific community), "broadening" (outside usual interests but worth seeing)
- explanation: one short sentence for the user explaining why this was picked

Respond with ONLY a JSON array, no markdown fences:
[{"id": 123, "score": 85, "reason": "topic_match", "explanation": "Matches your interest in TypeScript"}]

Scoring guidelines:
- High scores (70-100): directly matches user interests, high engagement, quality content
- Medium scores (40-69): tangentially related, broadly interesting
- Low scores (0-39): off-topic or low quality
- Prefer fresher content when relevance is similar; older items should earn high scores only when especially strong
- Penalize content similar to disliked items
- Boost content similar to recent saves
- Boost items that appeared in multiple sources — cross-source coverage signals importance`;
}

/**
 * Turns the LLM's reply into RankedItems that are safe to write to
 * curated_items. Models don't always return exactly the JSON array asked
 * for, so this tolerates prose or fences around the array, an array
 * wrapped in an object, and a reply truncated mid-array (keeping the
 * complete entries). Each entry must name a candidate's id and carry a
 * numeric score: score and explanation are NOT NULL columns, so one entry
 * without them used to abort the Curation Run after today's slice had
 * already been cleared. Invalid entries are dropped (the candidate then
 * scores 0); if nothing usable is left, falls back to similarity order.
 */
export function parseResponse(
  text: string,
  candidates: CandidateForRanking[],
): RankedItem[] {
  const candidateIds = new Set(candidates.map((c) => c.id));
  const seen = new Set<number>();
  const ranked: RankedItem[] = [];

  for (const entry of extractJsonArray(text) ?? []) {
    if (!entry || typeof entry !== "object") continue;
    const { id: rawId, score: rawScore, explanation, reason } = entry as Record<string, unknown>;
    const id = Number(rawId);
    const score = Number(rawScore);
    if (!candidateIds.has(id) || seen.has(id)) continue;
    if (rawScore === null || rawScore === "" || !Number.isFinite(score)) continue;
    seen.add(id);
    ranked.push({
      id,
      score: Math.min(100, Math.max(0, score)),
      explanation: typeof explanation === "string" ? explanation : "",
      reason: VALID_REASONS.has(reason as ReasonTag) ? (reason as ReasonTag) : "topic_match",
    });
  }

  if (ranked.length > 0) return ranked;

  console.error(
    "[ranker] No usable rankings in LLM response, falling back to trending.",
    "\nRaw response (first 500 chars):",
    text.slice(0, 500),
  );
  return candidates.map((c) => ({
    id: c.id,
    score: Math.round(c.similarityScore * 100),
    explanation: `Trending on ${c.source}`,
    reason: "trending" as ReasonTag,
  }));
}

function extractJsonArray(text: string): unknown[] | null {
  const cleaned = text
    .replace(/```json?\n?/g, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("[");
  const attempts = [
    cleaned,
    // Prose before/after the array.
    start >= 0 ? cleaned.slice(start, cleaned.lastIndexOf("]") + 1) : "",
    // Cut off mid-array (e.g. at the token limit): keep the complete entries.
    start >= 0 ? `${cleaned.slice(start, cleaned.lastIndexOf("}") + 1)}]` : "",
  ];
  for (const attempt of attempts) {
    const parsed = tryParseJson(attempt);
    if (Array.isArray(parsed)) return parsed;
    // e.g. {"rankings": [...]}
    if (parsed && typeof parsed === "object") {
      const inner = Object.values(parsed).find(Array.isArray);
      if (inner) return inner;
    }
  }
  return null;
}

function tryParseJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function rankWithAnthropic(
  prompt: string,
  candidates: CandidateForRanking[],
): Promise<RankedItem[]> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  return parseResponse(text, candidates);
}

async function rankWithOllama(
  prompt: string,
  candidates: CandidateForRanking[],
): Promise<RankedItem[]> {
  const ollamaUrl = process.env.OLLAMA_URL ?? "http://localhost:11434";
  const ollamaModel = process.env.OLLAMA_MODEL ?? "llama3.1:8b";
  const apiKey = process.env.OLLAMA_API_KEY;

  const res = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: ollamaModel,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      think: false,
      options: { temperature: 0.3, num_predict: 8192 },
    }),
  });

  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);

  const data = await res.json();
  console.log(
    "[ranker] Ollama response shape:",
    JSON.stringify({
      done_reason: data.done_reason,
      message_keys: data.message ? Object.keys(data.message) : null,
      content_length: data.message?.content?.length ?? 0,
      thinking_length: data.message?.thinking?.length ?? 0,
    }),
  );
  return parseResponse(data.message?.content ?? "", candidates);
}

export async function rankWithLLM(
  candidates: CandidateForRanking[],
  userTopics: string[],
  recentSaves: string[],
  recentDislikes: string[],
): Promise<RankedItem[]> {
  const prompt = buildPrompt(
    candidates,
    userTopics,
    recentSaves,
    recentDislikes,
  );

  if (process.env.ANTHROPIC_API_KEY) {
    return rankWithAnthropic(prompt, candidates);
  }

  return rankWithOllama(prompt, candidates);
}
