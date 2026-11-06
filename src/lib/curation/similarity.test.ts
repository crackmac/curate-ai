import { describe, it, expect } from "vitest";
import {
  cosineSimilarity,
  weightedInterestVector,
  rankBySimilarity,
} from "./similarity";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const v = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([0, 1]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it("returns -1 for opposite vectors", () => {
    const a = new Float32Array([1, 1]);
    const b = new Float32Array([-1, -1]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });

  it("returns 0 when either vector is all zeros (no divide-by-zero)", () => {
    const a = new Float32Array([0, 0]);
    const b = new Float32Array([1, 1]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });
});

describe("weightedInterestVector", () => {
  it("returns a 384-dim zero vector when there are no signals", () => {
    const v = weightedInterestVector([]);
    expect(v.length).toBe(384);
    expect([...v].every((x) => x === 0)).toBe(true);
  });

  it("produces an L2-normalized vector", () => {
    const v = weightedInterestVector([
      { embedding: new Float32Array([3, 4]), weight: 1 },
      { embedding: new Float32Array([1, 0]), weight: 0.5 },
    ]);
    const norm = Math.sqrt([...v].reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("pulls the profile toward the more heavily weighted signal", () => {
    const v = weightedInterestVector([
      { embedding: new Float32Array([1, 0]), weight: 1 },
      { embedding: new Float32Array([0, 1]), weight: 1 / 3 },
    ]);
    // Weighted mean (0.75, 0.25), normalized: (0.9487, 0.3162).
    expect(v[0]).toBeCloseTo(0.9487, 3);
    expect(v[1]).toBeCloseTo(0.3162, 3);
  });
});

describe("rankBySimilarity", () => {
  it("sorts candidates by descending similarity to the interest vector", () => {
    const interest = new Float32Array([1, 0]);
    const ranked = rankBySimilarity(
      [
        { id: 1, embedding: new Float32Array([0, 1]) }, // orthogonal
        { id: 2, embedding: new Float32Array([1, 0]) }, // identical
      ],
      interest,
    );
    expect(ranked.map((r) => r.id)).toEqual([2, 1]);
  });
});
