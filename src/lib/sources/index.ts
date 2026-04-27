import type { SourceAdapter } from "./types";
import { hackernewsAdapter } from "./hackernews";
import { redditAdapter } from "./reddit";
import { rssAdapter } from "./rss";
import { youtubeAdapter } from "./youtube";
import { blueskyAdapter } from "./bluesky";

const adapters: Record<string, SourceAdapter> = {
  hackernews: hackernewsAdapter,
  reddit: redditAdapter,
  rss: rssAdapter,
  youtube: youtubeAdapter,
  bluesky: blueskyAdapter,
};

export function getAdapter(type: string): SourceAdapter | undefined {
  return adapters[type];
}

export function getAllAdapters(): SourceAdapter[] {
  return Object.values(adapters);
}
