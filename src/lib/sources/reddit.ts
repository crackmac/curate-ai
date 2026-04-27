import type { SourceAdapter, RawContentItem, SourceConfig } from "./types";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET are required");
  }

  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "CurateAI/1.0",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error(`Reddit auth error: ${res.status}`);

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cachedToken.token;
}

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext?: string;
    url: string;
    permalink: string;
    author: string;
    score: number;
    num_comments: number;
    created_utc: number;
    thumbnail?: string;
    preview?: {
      images?: Array<{
        source?: { url: string };
      }>;
    };
    is_video?: boolean;
    is_self?: boolean;
    link_flair_text?: string;
  };
}

export const redditAdapter: SourceAdapter = {
  id: "reddit",

  async fetch(config: SourceConfig): Promise<RawContentItem[]> {
    const subreddit = config.subreddit;
    if (!subreddit) return [];

    const token = await getAccessToken();

    const res = await fetch(
      `https://oauth.reddit.com/r/${subreddit}/hot.json?limit=25`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "CurateAI/1.0",
        },
      }
    );

    if (!res.ok) throw new Error(`Reddit API error: ${res.status}`);

    const data = await res.json();
    const posts: RedditPost[] = data.data.children;
    const items: RawContentItem[] = [];

    for (const post of posts) {
      const p = post.data;
      if (p.title.startsWith("[removed]")) continue;

      const previewUrl = p.preview?.images?.[0]?.source?.url?.replace(
        /&amp;/g,
        "&"
      );
      const thumbnail =
        previewUrl ||
        (p.thumbnail && p.thumbnail.startsWith("http") ? p.thumbnail : undefined);

      items.push({
        externalId: p.id,
        type: p.is_self ? "social" : "article",
        title: p.title,
        summary: p.selftext ? p.selftext.slice(0, 300) : undefined,
        url: p.is_self
          ? `https://reddit.com${p.permalink}`
          : p.url,
        author: p.author,
        thumbnailUrl: thumbnail,
        publishedAt: new Date(p.created_utc * 1000).toISOString(),
        metadata: {
          score: p.score,
          commentCount: p.num_comments,
          subreddit,
          flair: p.link_flair_text || null,
          redditUrl: `https://reddit.com${p.permalink}`,
        },
      });
    }

    return items;
  },
};
