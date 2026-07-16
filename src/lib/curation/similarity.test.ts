import { describe, it, expect } from "vitest";
import {
  cosineSimilarity,
  computeInterestVector,
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

describe("computeInterestVector", () => {
  it("returns a 384-dim zero vector when there are no embeddings", () => {
    const v = computeInterestVector([]);
    expect(v.length).toBe(384);
    expect([...v].every((x) => x === 0)).toBe(true);
  });

  it("produces an L2-normalized vector", () => {
    const v = computeInterestVector([
      new Float32Array([3, 4]),
      new Float32Array([1, 0]),
    ]);
    const norm = Math.sqrt([...v].reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
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
      interest
    );
    expect(ranked.map((r) => r.id)).toEqual([2, 1]);
  });
});
