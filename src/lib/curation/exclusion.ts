export interface ItemInteraction {
  contentItemId: number;
  type: string;
}

// Content Items hidden from the Digest for good: Dismissed, or currently
// marked Less Like This. Undo removes the row, which un-hides the item.
export function hiddenFromDigest(interactions: ItemInteraction[]): Set<number> {
  return new Set(
    interactions
      .filter((i) => i.type === "dismiss" || i.type === "less_like_this")
      .map((i) => i.contentItemId),
  );
}

// Content Items a Curation Run must not pick: anything the User has
// interacted with never appears in a later Digest.
export function excludedFromCuration(
  interactions: ItemInteraction[],
  todaysDigestIds: Set<number>,
): Set<number> {
  const excluded = new Set(interactions.map((i) => i.contentItemId));
  const hidden = hiddenFromDigest(interactions);
  // Same-day exception: today's Digest is rebuilt several times a day, so
  // Clicked/Saved items already in it stay eligible until the day ends.
  // Hidden items override it.
  for (const id of todaysDigestIds) {
    if (!hidden.has(id)) excluded.delete(id);
  }
  return excluded;
}
