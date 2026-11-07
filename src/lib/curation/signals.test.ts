import { describe, it, expect } from "vitest";
import {
  positiveSignalWeights,
  topicSignalWeight,
  CLICK_WEIGHT,
} from "./signals";

describe("topicSignalWeight", () => {
  it("splits one newest-Save's weight across the Topics at Cold Start", () => {
    expect(topicSignalWeight(4, 0)).toBeCloseTo(0.25, 5);
  });

  it("fades Topics as Positive Signals accumulate, as if older than all of them", () => {
    expect(topicSignalWeight(1, 1)).toBeCloseTo(0.9, 5);
    expect(topicSignalWeight(2, 20)).toBeCloseTo(0.0608, 3); // 0.9^20 / 2
  });
});

const click = (contentItemId: number) => ({ contentItemId, type: "click" });
const save = (contentItemId: number) => ({ contentItemId, type: "save" });

describe("positiveSignalWeights", () => {
  it("counts an item that was Clicked and Saved once, as a Save", () => {
    const weights = positiveSignalWeights([save(1), click(1)]);
    expect([...weights]).toEqual([[1, 1]]);
  });

  it("counts a Click at a third of a Save, and re-opening the item adds nothing", () => {
    const weights = positiveSignalWeights([click(2), click(2), click(2)]);
    expect(CLICK_WEIGHT).toBeCloseTo(1 / 3);
    expect([...weights]).toEqual([[2, CLICK_WEIGHT]]);
  });

  it("gives no Positive Signal to a Clicked item later marked Less Like This", () => {
    const weights = positiveSignalWeights([
      { contentItemId: 3, type: "less_like_this" },
      click(3),
    ]);
    expect(weights.size).toBe(0);
  });

  it("weights each window newest-first, independently of the other", () => {
    const weights = positiveSignalWeights([
      click(10),
      save(1),
      click(11),
      save(2),
    ]);
    expect(weights.get(1)).toBeCloseTo(1);
    expect(weights.get(2)).toBeCloseTo(0.9);
    expect(weights.get(10)).toBeCloseTo(1 / 3);
    expect(weights.get(11)).toBeCloseTo(0.3);
  });

  it("keeps an older Save through a binge of 60 Clicks, holding 50 Clicked items", () => {
    const binge = Array.from({ length: 60 }, (_, n) => click(100 + n));
    const weights = positiveSignalWeights([...binge, save(1)]);
    expect(weights.get(1)).toBeCloseTo(1);
    expect(weights.has(149)).toBe(true);
    expect(weights.has(150)).toBe(false);
    expect(weights.size).toBe(51);
  });

  it("never counts a Saved item as a Click, even once its Save has left the window", () => {
    const recentSaves = Array.from({ length: 50 }, (_, n) => save(200 + n));
    const weights = positiveSignalWeights([click(1), ...recentSaves, save(1)]);
    expect(weights.has(1)).toBe(false);
  });
});
