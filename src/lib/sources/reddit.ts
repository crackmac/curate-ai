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

const FETCH_TIMEOUT_MS = 20000;
// Reddit's maximum page size; a combined feed is shared by every subreddit in it.
const COMBINED_FEED_LIMIT = 100;
const PER_SUBREDDIT_LIMIT = 25;
// Unauthenticated .rss allows about one request a minute
// (x-ratelimit-remaining drops to 0 after one call), so requests are paced by
// Reddit's rate-limit headers, with this as the minimum gap when they're absent.
const MIN_REQUEST_GAP_MS = 5000;
const MAX_RATE_LIMIT_WAIT_MS = 120_000;

const parser = new Parser();

type FeedEntry = Parser.Item;

export const redditAdapter: SourceAdapter = {
  id: "reddit",

  async fetch(config: SourceConfig): Promise<RawContentItem[]> {
    const subreddit = config.subreddit;
    if (!subreddit) return [];
    const bySubreddit = await fetchSubreddits([subreddit]);
    return bySubreddit.get(subreddit) ?? [];
  },
};

/**
 * Fetches several subreddits' hot posts in one combined request
 * (`/r/a+b+c/hot/.rss`) and splits the result back out per subreddit, keyed
 * by the names as given. One request per Category keeps an Ingest Run under
 * Reddit's unauthenticated rate limit.
 */
export async function fetchSubreddits(
  subreddits: string[],
): Promise<Map<string, RawContentItem[]>> {
  if (subreddits.length === 0) return new Map();

  await waitForRateLimit();
  const res = await fetch(combinedFeedUrl(subreddits), {
    headers: {
      "User-Agent": REDDIT_USER_AGENT,
      Accept: "application/atom+xml, application/rss+xml, */*",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  nextRequestAt =
    Date.now() +
    Math.max(
      MIN_REQUEST_GAP_MS,
      rateLimitWaitMs(
        res.headers.get("x-ratelimit-remaining"),
        res.headers.get("x-ratelimit-reset"),
      ),
    );
  if (!res.ok) throw new Error(`Status code ${res.status}`);

  const feed = await parser.parseString(await res.text());
  const result = new Map<string, RawContentItem[]>();
  const usable = feed.items.filter((entry) => entry.title && entry.link);
  for (const [subreddit, entries] of splitBySubreddit(usable, subreddits)) {
    result.set(subreddit, entries.map((entry) => toContentItem(entry, subreddit)));
  }
  return result;
}

export function combinedFeedUrl(subreddits: string[]): string {
  const path = subreddits.map((s) => encodeURIComponent(s)).join("+");
  return `https://www.reddit.com/r/${path}/hot/.rss?limit=${COMBINED_FEED_LIMIT}`;
}

/**
 * Assigns each entry of a combined feed to the subreddit in its permalink
 * (`/r/<name>/comments/...`), matched case-insensitively against the requested
 * names. Returns a key for every requested subreddit, in feed order, capped at
 * PER_SUBREDDIT_LIMIT each; entries for any other subreddit are dropped.
 */
export function splitBySubreddit<T extends { link?: string }>(
  entries: T[],
  subreddits: string[],
): Map<string, T[]> {
  const byLowerName = new Map(subreddits.map((s) => [s.toLowerCase(), s]));
  const result = new Map<string, T[]>(subreddits.map((s) => [s, []]));
  for (const entry of entries) {
    const name = entry.link?.match(/\/r\/([^/?#]+)/i)?.[1]?.toLowerCase();
    const subreddit = name && byLowerName.get(name);
    if (!subreddit) continue;
    const bucket = result.get(subreddit)!;
    if (bucket.length < PER_SUBREDDIT_LIMIT) bucket.push(entry);
  }
  return result;
}

/**
 * How long to wait before the next request, from Reddit's
 * x-ratelimit-remaining / x-ratelimit-reset (seconds) headers: until the
 * window resets (plus a second of slack) once no requests remain, else 0.
 */
export function rateLimitWaitMs(
  remaining: string | null,
  reset: string | null,
): number {
  const left = Number.parseFloat(remaining ?? "");
  const resetSeconds = Number.parseFloat(reset ?? "");
  if (!Number.isFinite(left) || !Number.isFinite(resetSeconds)) return 0;
  if (left >= 1) return 0;
  return Math.min(MAX_RATE_LIMIT_WAIT_MS, Math.ceil(resetSeconds) * 1000 + 1000);
}

// Shared by every caller in this server process, so back-to-back Ingest Runs
// (e.g. Refresh on "All" ingesting each Category in turn) also respect it.
let nextRequestAt = 0;

async function waitForRateLimit() {
  const waitMs = nextRequestAt - Date.now();
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
}

function toContentItem(entry: FeedEntry, subreddit: string): RawContentItem {
  const content = entry.content || entry.contentSnippet || "";
  return {
    externalId: entry.guid || entry.link!,
    type: "article",
    title: entry.title!,
    summary: stripHtml(content).slice(0, 300),
    url: entry.link!,
    author: entry.creator || undefined,
    thumbnailUrl: extractImageFromContent(content),
    publishedAt: entry.isoDate || entry.pubDate || undefined,
    metadata: {
      subreddit,
      redditUrl: entry.link,
    },
  };
}
