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

function parseResponse(
  text: string,
  candidates: CandidateForRanking[],
): RankedItem[] {
  const cleaned = text
    .replace(/```json?\n?/g, "")
    .replace(/```/g, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as RankedItem[];
    return parsed.map((item) => ({
      ...item,
      reason: VALID_REASONS.has(item.reason) ? item.reason : "topic_match",
    }));
  } catch (err) {
    console.error(
      "[ranker] Failed to parse LLM response as JSON, falling back to trending:",
      err,
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
