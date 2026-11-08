import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseResponse } from "./ranker";

const candidate = (id: number, similarityScore = 0.5) => ({
  id,
  title: `Item ${id}`,
  summary: null,
  type: "article",
  source: "Hacker News",
  author: null,
  publishedAt: "2026-11-07T00:00:00.000Z",
  similarityScore,
});

const candidates = [candidate(1, 0.9), candidate(2, 0.4), candidate(3, 0.2)];

const isFallback = (ranked: ReturnType<typeof parseResponse>) =>
  ranked.every((r) => r.reason === "trending" && r.explanation.startsWith("Trending on"));

describe("parseResponse", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses a clean JSON array", () => {
    const ranked = parseResponse(
      '[{"id": 1, "score": 85, "reason": "deep_dive", "explanation": "Great read"}]',
      candidates,
    );
    expect(ranked).toEqual([
      { id: 1, score: 85, reason: "deep_dive", explanation: "Great read" },
    ]);
  });

  it("strips markdown fences", () => {
    const ranked = parseResponse(
      '```json\n[{"id": 2, "score": 40, "reason": "trending", "explanation": "x"}]\n```',
      candidates,
    );
    expect(ranked.map((r) => r.id)).toEqual([2]);
  });

  it("finds the array when the model adds prose around it", () => {
    const ranked = parseResponse(
      'Here are my rankings:\n[{"id": 1, "score": 90, "reason": "topic_match", "explanation": "a"}]\nLet me know if you need more.',
      candidates,
    );
    expect(isFallback(ranked)).toBe(false);
    expect(ranked).toEqual([{ id: 1, score: 90, reason: "topic_match", explanation: "a" }]);
  });

  it("unwraps an array returned inside an object", () => {
    const ranked = parseResponse(
      '{"rankings": [{"id": 3, "score": 55, "reason": "broadening", "explanation": "b"}]}',
      candidates,
    );
    expect(ranked.map((r) => [r.id, r.score])).toEqual([[3, 55]]);
  });

  it("keeps the complete entries of a reply cut off mid-array", () => {
    const ranked = parseResponse(
      '[{"id": 1, "score": 80, "reason": "topic_match", "explanation": "a"}, {"id": 2, "score": 60, "reason": "trend',
      candidates,
    );
    expect(ranked.map((r) => r.id)).toEqual([1]);
  });

  it("drops entries without a usable score instead of passing NaN/undefined on", () => {
    // score and explanation are NOT NULL in curated_items: NaN/undefined made
    // the insert throw after today's slice had been deleted.
    const ranked = parseResponse(
      JSON.stringify([
        { id: 1, score: 70, reason: "topic_match", explanation: "ok" },
        { id: 2, reason: "topic_match", explanation: "no score" },
        { id: 3, score: "high", reason: "topic_match", explanation: "bad score" },
      ]),
      candidates,
    );
    expect(ranked.map((r) => r.id)).toEqual([1]);
    for (const r of ranked) expect(Number.isFinite(r.score)).toBe(true);
  });

  it("defaults a missing explanation to an empty string and coerces numeric strings", () => {
    const [ranked] = parseResponse('[{"id": "2", "score": "64"}]', candidates);
    expect(ranked).toEqual({ id: 2, score: 64, reason: "topic_match", explanation: "" });
  });

  it("ignores ids that aren't candidates and repeated ids", () => {
    const ranked = parseResponse(
      JSON.stringify([
        { id: 99, score: 100, reason: "breaking", explanation: "hallucinated" },
        { id: 1, score: 50, reason: "topic_match", explanation: "first" },
        { id: 1, score: 10, reason: "topic_match", explanation: "repeat" },
      ]),
      candidates,
    );
    expect(ranked).toEqual([{ id: 1, score: 50, reason: "topic_match", explanation: "first" }]);
  });

  it("clamps scores to 0-100 and replaces unknown reasons", () => {
    const ranked = parseResponse(
      '[{"id": 1, "score": 140, "reason": "vibes", "explanation": "a"}, {"id": 2, "score": -5, "reason": "trending", "explanation": "b"}]',
      candidates,
    );
    expect(ranked.map((r) => [r.score, r.reason])).toEqual([
      [100, "topic_match"],
      [0, "trending"],
    ]);
  });

  it("falls back to similarity order when nothing usable comes back", () => {
    for (const text of ["", "Sorry, I can't help with that.", "[]", '[{"id": 99, "score": 5}]']) {
      const ranked = parseResponse(text, candidates);
      expect(isFallback(ranked)).toBe(true);
      expect(ranked.map((r) => [r.id, r.score])).toEqual([
        [1, 90],
        [2, 40],
        [3, 20],
      ]);
    }
  });
});
