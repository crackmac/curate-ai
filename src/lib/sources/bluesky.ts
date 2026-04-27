import type { SourceAdapter, RawContentItem, SourceConfig } from "./types";

const BSKY_API = "https://public.api.bsky.app/xrpc";

interface BskyPost {
  uri: string;
  cid: string;
  author: {
    handle: string;
    displayName?: string;
  };
  record: {
    text: string;
    createdAt: string;
  };
  embed?: {
    $type: string;
    external?: {
      uri: string;
      title: string;
      description: string;
      thumb?: string;
    };
    images?: Array<{
      thumb: string;
      alt: string;
    }>;
  };
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
}

export const blueskyAdapter: SourceAdapter = {
  id: "bluesky",

  async fetch(config: SourceConfig): Promise<RawContentItem[]> {
    const query = config.searchQuery as string | undefined;
    const actor = config.actor as string | undefined;

    if (actor) {
      return fetchAuthorFeed(actor);
    }

    if (query) {
      return searchPosts(query);
    }

    return searchPosts("technology OR programming OR software");
  },
};

async function searchPosts(query: string): Promise<RawContentItem[]> {
  const res = await fetch(
    `${BSKY_API}/app.bsky.feed.searchPosts?` +
      new URLSearchParams({
        q: query,
        limit: "25",
        sort: "top",
      })
  );

  if (!res.ok) throw new Error(`BlueSky search error: ${res.status}`);

  const data = await res.json();
  return (data.posts || []).map(mapPost);
}

async function fetchAuthorFeed(actor: string): Promise<RawContentItem[]> {
  const res = await fetch(
    `${BSKY_API}/app.bsky.feed.getAuthorFeed?` +
      new URLSearchParams({
        actor,
        limit: "25",
        filter: "posts_no_replies",
      })
  );

  if (!res.ok) throw new Error(`BlueSky author feed error: ${res.status}`);

  const data = await res.json();
  return (data.feed || []).map((item: { post: BskyPost }) => mapPost(item.post));
}

function mapPost(post: BskyPost): RawContentItem {
  const external = post.embed?.external;
  const image = post.embed?.images?.[0]?.thumb;

  const url = external?.uri || `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split("/").pop()}`;
  const title = external?.title || post.record.text.slice(0, 120);
  const summary = external?.description || (external?.title ? post.record.text.slice(0, 300) : undefined);

  return {
    externalId: post.cid,
    type: "social",
    title,
    summary,
    url,
    author: post.author.displayName || post.author.handle,
    thumbnailUrl: external?.thumb || image,
    publishedAt: post.record.createdAt,
    metadata: {
      handle: post.author.handle,
      likeCount: post.likeCount ?? 0,
      repostCount: post.repostCount ?? 0,
      replyCount: post.replyCount ?? 0,
      bskyUrl: `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split("/").pop()}`,
    },
  };
}
