export const STATE_TYPES = ["save", "less_like_this"];

export interface InteractionRow {
  id: number;
  contentItemId: number;
  type: string;
  createdAt: string;
}

// Before Save and Less Like This became states, every toggle (on or off)
// appended the same Interaction. An odd count means the state is on.
// Returns the ids to delete so at most one row per item+state remains.
export function resolveToggleHistory(rows: InteractionRow[]): {
  remove: number[];
} {
  const groups = new Map<string, InteractionRow[]>();
  for (const r of rows) {
    if (!STATE_TYPES.includes(r.type)) continue;
    const key = `${r.contentItemId}:${r.type}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const remove: number[] = [];
  const survivorByItem = new Map<number, InteractionRow>();
  for (const group of groups.values()) {
    const sorted = group.sort(newestFirst);
    if (sorted.length % 2 === 0) {
      remove.push(...sorted.map((r) => r.id));
      continue;
    }
    remove.push(...sorted.slice(1).map((r) => r.id));

    // Save and Less Like This are mutually exclusive: the later turn-on wins.
    const kept = sorted[0];
    const rival = survivorByItem.get(kept.contentItemId);
    if (!rival) survivorByItem.set(kept.contentItemId, kept);
    else if (newestFirst(kept, rival) < 0) {
      remove.push(rival.id);
      survivorByItem.set(kept.contentItemId, kept);
    } else remove.push(kept.id);
  }
  return { remove };
}

// Newest first; id breaks same-second ties.
function newestFirst(a: InteractionRow, b: InteractionRow): number {
  return b.createdAt.localeCompare(a.createdAt) || b.id - a.id;
}
