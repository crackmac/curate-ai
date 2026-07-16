import Parser from "rss-parser";
import type { SourceAdapter, RawContentItem, SourceConfig } from "./types";
import { stripHtml, extractImageFromContent } from "./rss";

// Reddit 403s the public .json endpoint for unauthenticated/datacenter clients
// regardless of user-agent, but the per-subreddit Atom feed (/.rss) still
// serves. We read that instead. A browser-like UA avoids the bot-UA block;
// override via env if you hit rate limits or run an authenticated app.
const REDDIT_USER_AGENT =
  process.env.REDDIT_USER_AGENT ||
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const parser = new Parser({
  timeout: 20000,
  headers: {
    "User-Agent": REDDIT_USER_AGENT,
    Accept: "application/atom+xml, application/rss+xml, */*",
  },
});

export const redditAdapter: SourceAdapter = {
  id: "reddit",

  async fetch(config: SourceConfig): Promise<RawContentItem[]> {
    const subreddit = config.subreddit;
    if (!subreddit) return [];

    const feed = await parser.parseURL(
      `https://www.reddit.com/r/${subreddit}/hot/.rss?limit=25`
    );

    const items: RawContentItem[] = [];
    for (const entry of feed.items.slice(0, 25)) {
      if (!entry.title || !entry.link) continue;

      // rss-parser maps the Atom <id> ("t3_abc123") to guid.
      const content = entry.content || entry.contentSnippet || "";
      items.push({
        externalId: entry.guid || entry.link,
        type: "article",
        title: entry.title,
        summary: stripHtml(content).slice(0, 300),
        url: entry.link,
        author: entry.creator || undefined,
        thumbnailUrl: extractImageFromContent(content),
        publishedAt: entry.isoDate || entry.pubDate || undefined,
        metadata: {
          subreddit,
          redditUrl: entry.link,
        },
      });
    }

    return items;
  },
};
