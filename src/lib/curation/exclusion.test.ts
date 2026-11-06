import { describe, it, expect } from "vitest";
import { excludedFromCuration, hiddenFromDigest } from "./exclusion";

const i = (contentItemId: number, type: string) => ({ contentItemId, type });

describe("excludedFromCuration", () => {
  it("skips every item the User has interacted with that isn't in today's Digest", () => {
    const excluded = excludedFromCuration(
      [i(1, "click"), i(2, "save"), i(3, "dismiss"), i(4, "less_like_this")],
      new Set(),
    );
    expect([...excluded].sort()).toEqual([1, 2, 3, 4]);
  });

  it("keeps items in today's Digest that were only Clicked or Saved eligible for today's re-runs", () => {
    const excluded = excludedFromCuration(
      [i(1, "click"), i(2, "save"), i(2, "click"), i(9, "click")],
      new Set([1, 2]),
    );
    expect([...excluded]).toEqual([9]);
  });

  it("excludes Dismissed and Less Like This items even when they're in today's Digest", () => {
    const excluded = excludedFromCuration(
      [i(3, "dismiss"), i(4, "click"), i(4, "less_like_this")],
      new Set([3, 4]),
    );
    expect([...excluded].sort()).toEqual([3, 4]);
  });
});

describe("hiddenFromDigest", () => {
  it("hides Dismissed and Less Like This items, but not Clicked or Saved ones", () => {
    const hidden = hiddenFromDigest([
      i(1, "click"),
      i(2, "save"),
      i(3, "dismiss"),
      i(4, "less_like_this"),
    ]);
    expect([...hidden].sort()).toEqual([3, 4]);
  });
});
