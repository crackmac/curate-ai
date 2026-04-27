import { db } from "./index";
import { sources, users, userPreferences } from "./schema";

const defaultSources = [
  {
    slug: "hackernews",
    name: "Hacker News",
    type: "hackernews",
    url: "https://news.ycombinator.com",
    config: "{}",
    isDefault: 1,
    vetted: 1,
    description: "Top stories from YCombinator's Hacker News",
  },
  {
    slug: "reddit/r/programming",
    name: "r/programming",
    type: "reddit",
    url: "https://reddit.com/r/programming",
    config: JSON.stringify({ subreddit: "programming" }),
    isDefault: 1,
    vetted: 1,
    description: "Programming news and discussion",
  },
  {
    slug: "reddit/r/typescript",
    name: "r/typescript",
    type: "reddit",
    url: "https://reddit.com/r/typescript",
    config: JSON.stringify({ subreddit: "typescript" }),
    isDefault: 1,
    vetted: 1,
    description: "TypeScript community",
  },
  {
    slug: "reddit/r/webdev",
    name: "r/webdev",
    type: "reddit",
    url: "https://reddit.com/r/webdev",
    config: JSON.stringify({ subreddit: "webdev" }),
    isDefault: 1,
    vetted: 1,
    description: "Web development community",
  },
  {
    slug: "rss/tldr",
    name: "TLDR Newsletter",
    type: "rss",
    url: "https://tldr.tech/api/rss/tech",
    config: JSON.stringify({ feedUrl: "https://tldr.tech/api/rss/tech" }),
    isDefault: 1,
    vetted: 1,
    description: "Daily tech newsletter digest",
  },
  {
    slug: "rss/ars-technica",
    name: "Ars Technica",
    type: "rss",
    url: "https://feeds.arstechnica.com/arstechnica/index",
    config: JSON.stringify({ feedUrl: "https://feeds.arstechnica.com/arstechnica/index" }),
    isDefault: 1,
    vetted: 1,
    description: "Technology news and analysis",
  },
  {
    slug: "youtube/fireship",
    name: "Fireship",
    type: "youtube",
    url: "https://www.youtube.com/@Fireship",
    config: JSON.stringify({ channelId: "UCsBjURrPoezykLs9EqgamOA" }),
    isDefault: 1,
    vetted: 1,
    description: "Fast-paced tech tutorials and news",
  },
  {
    slug: "youtube/theo",
    name: "Theo - t3.gg",
    type: "youtube",
    url: "https://www.youtube.com/@t3dotgg",
    config: JSON.stringify({ channelId: "UCbRP3c757lWg9M-U7TyEkXA" }),
    isDefault: 1,
    vetted: 1,
    description: "Web dev opinions and deep dives",
  },
  {
    slug: "bluesky/simon-willison",
    name: "Simon Willison",
    type: "bluesky",
    url: "https://bsky.app/profile/simonwillison.net",
    config: JSON.stringify({ actor: "simonwillison.net" }),
    isDefault: 1,
    vetted: 1,
    description: "AI and web development insights",
  },
  {
    slug: "bluesky/swyx",
    name: "swyx",
    type: "bluesky",
    url: "https://bsky.app/profile/swyx.bsky.social",
    config: JSON.stringify({ actor: "swyx.bsky.social" }),
    isDefault: 1,
    vetted: 1,
    description: "AI engineering and developer experience",
  },
];

export async function seed() {
  for (const source of defaultSources) {
    db.insert(sources).values(source).onConflictDoNothing().run();
  }

  const existingUser = db.select().from(users).limit(1).all();
  if (existingUser.length === 0) {
    db.insert(users)
      .values({ email: "user@local.dev", name: "Local User", onboarded: 1 })
      .run();
    db.insert(userPreferences)
      .values({
        userId: 1,
        topics: JSON.stringify([
          "typescript",
          "ai",
          "web development",
          "startups",
        ]),
        contentTypes: JSON.stringify([
          "article",
          "video",
          "short",
          "social",
        ]),
        digestSize: 20,
      })
      .run();
  }
}
