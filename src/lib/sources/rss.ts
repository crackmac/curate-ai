import Parser from "rss-parser";
import type { SourceAdapter, RawContentItem, SourceConfig } from "./types";

const parser = new Parser({
  timeout: 20000,
  headers: {
    "User-Agent": "CurateAI/1.0",
  },
});

export const rssAdapter: SourceAdapter = {
  id: "rss",

  async fetch(config: SourceConfig): Promise<RawContentItem[]> {
    const feedUrl = config.feedUrl;
    if (!feedUrl) return [];

    const feed = await parser.parseURL(feedUrl);
    const items: RawContentItem[] = [];

    for (const entry of feed.items.slice(0, 25)) {
      if (!entry.title || !entry.link) continue;

      items.push({
        externalId: entry.guid || entry.link,
        type: "article",
        title: entry.title,
        summary: stripHtml(entry.contentSnippet || entry.content || "").slice(
          0,
          300
        ),
        url: entry.link,
        author: entry.creator || entry["dc:creator"] || undefined,
        thumbnailUrl: extractImageFromContent(entry.content || ""),
        publishedAt: entry.isoDate || entry.pubDate || undefined,
        metadata: {
          feedTitle: feed.title || "",
          categories: entry.categories || [],
        },
      });
    }

    return items;
  },
};

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export function extractImageFromContent(html: string): string | undefined {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/);
  return match?.[1];
}
