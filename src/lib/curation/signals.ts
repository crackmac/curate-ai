export const CLICK_WEIGHT = 1 / 3;
export const DECAY = 0.9;
export const WINDOW_SIZE = 50;

export interface SignalInteraction {
  contentItemId: number;
  type: string;
}

// Turns a User's Interactions (newest first) into one Positive Signal weight
// per Content Item, for building the Interest Profile. Saves and Clicks are
// separate windows, each weighted newest-first, so Clicks never crowd out Saves.
export function positiveSignalWeights(
  interactions: SignalInteraction[],
): Map<number, number> {
  const allSavedIds = distinct(interactions, "save");
  const savedIds = allSavedIds.slice(0, WINDOW_SIZE);
  // Every current Save, not just the windowed ones: a Saved item never counts as a Click.
  const saved = new Set(allSavedIds);
  const disliked = new Set(distinct(interactions, "less_like_this"));
  // A Save supersedes Clicks on the same item; Less Like This cancels them.
  const clickedIds = distinct(interactions, "click")
    .filter((id) => !saved.has(id) && !disliked.has(id))
    .slice(0, WINDOW_SIZE);

  const weights = new Map<number, number>();
  savedIds.forEach((id, rank) => weights.set(id, DECAY ** rank));
  clickedIds.forEach((id, rank) =>
    weights.set(id, CLICK_WEIGHT * DECAY ** rank),
  );
  return weights;
}

// Item ids of one Interaction type, newest first, each listed once.
function distinct(interactions: SignalInteraction[], type: string): number[] {
  return [
    ...new Set(
      interactions.filter((i) => i.type === type).map((i) => i.contentItemId),
    ),
  ];
}
