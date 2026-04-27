import type { SourceAdapter, RawContentItem } from "./types";

const HN_API = "https://hacker-news.firebaseio.com/v0";

interface HNItem {
  id: number;
  title?: string;
  url?: string;
  by?: string;
  score?: number;
  descendants?: number;
  time?: number;
  type?: string;
}

async function fetchItem(id: number): Promise<HNItem | null> {
  const res = await fetch(`${HN_API}/item/${id}.json`);
  if (!res.ok) return null;
  return res.json();
}

export const hackernewsAdapter: SourceAdapter = {
  id: "hackernews",

  async fetch(): Promise<RawContentItem[]> {
    const res = await fetch(`${HN_API}/topstories.json`);
    if (!res.ok) throw new Error(`HN API error: ${res.status}`);

    const storyIds: number[] = await res.json();
    const topIds = storyIds.slice(0, 30);

    const chunks: number[][] = [];
    for (let i = 0; i < topIds.length; i += 10) {
      chunks.push(topIds.slice(i, i + 10));
    }

    const items: RawContentItem[] = [];

    for (const chunk of chunks) {
      const results = await Promise.all(chunk.map(fetchItem));
      for (const item of results) {
        if (!item?.title || !item.url) continue;
        items.push({
          externalId: String(item.id),
          type: "article",
          title: item.title,
          summary: undefined,
          url: item.url,
          author: item.by,
          publishedAt: item.time
            ? new Date(item.time * 1000).toISOString()
            : undefined,
          metadata: {
            score: item.score ?? 0,
            commentCount: item.descendants ?? 0,
            hnUrl: `https://news.ycombinator.com/item?id=${item.id}`,
          },
        });
      }
    }

    return items;
  },
};
