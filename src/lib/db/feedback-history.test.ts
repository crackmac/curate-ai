import { describe, it, expect } from "vitest";
import { resolveToggleHistory } from "./feedback-history";

const row = (
  id: number,
  contentItemId: number,
  type: string,
  createdAt = `2026-01-01 00:00:${String(id).padStart(2, "0")}`,
) => ({ id, contentItemId, type, createdAt });

describe("resolveToggleHistory", () => {
  it("keeps a Save toggled on once, and removes a Save toggled on then off", () => {
    const result = resolveToggleHistory([
      row(1, 100, "save"),
      row(2, 200, "save"),
      row(3, 200, "save"),
    ]);
    expect(result.remove.sort()).toEqual([2, 3]);
  });

  it("keeps the most recent turn-on when a state was toggled an odd number of times", () => {
    const result = resolveToggleHistory([
      row(7, 100, "save", "2026-01-01 00:00:00"),
      row(9, 100, "save", "2026-01-03 00:00:00"),
      row(8, 100, "save", "2026-01-02 00:00:00"),
    ]);
    expect(result.remove.sort()).toEqual([7, 8]);
  });

  it("keeps only the more recently turned-on state when an item ends up both Saved and Less Like This", () => {
    const result = resolveToggleHistory([
      row(1, 100, "less_like_this", "2026-01-02 00:00:00"),
      row(2, 100, "save", "2026-01-01 00:00:00"),
      row(3, 200, "save", "2026-01-02 00:00:00"),
      row(4, 200, "less_like_this", "2026-01-01 00:00:00"),
    ]);
    expect(result.remove.sort()).toEqual([2, 4]);
  });

  it("never removes Clicks or Dismisses, which are events rather than states", () => {
    const result = resolveToggleHistory([
      row(1, 100, "click"),
      row(2, 100, "click"),
      row(3, 100, "dismiss"),
      row(4, 100, "dismiss"),
    ]);
    expect(result.remove).toEqual([]);
  });
});
