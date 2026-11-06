"use client";

import type { InteractionType } from "@/types";

export function useInteraction() {
  async function record(
    contentItemId: number,
    type: InteractionType,
    active?: boolean,
  ) {
    await fetch("/api/interact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentItemId, type, active }),
    });
  }

  return { record };
}
