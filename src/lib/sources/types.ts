export interface RawContentItem {
  externalId: string;
  type: "article" | "video" | "short" | "social";
  title: string;
  summary?: string;
  url: string;
  author?: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  metadata: Record<string, unknown>;
}

export interface SourceConfig {
  subreddit?: string;
  channelId?: string;
  feedUrl?: string;
  [key: string]: unknown;
}

export interface SourceAdapter {
  id: string;
  fetch(config: SourceConfig): Promise<RawContentItem[]>;
}
