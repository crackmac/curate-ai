export interface ContentItem {
  id: number;
  sourceId: number;
  externalId: string;
  type: "article" | "video" | "short" | "social";
  title: string;
  summary: string | null;
  url: string;
  author: string | null;
  thumbnailUrl: string | null;
  metadata: Record<string, unknown>;
  fetchedAt: string;
  publishedAt: string | null;
}

export type ReasonTag =
  | "topic_match"
  | "trending"
  | "saved_similar"
  | "high_engagement"
  | "breaking"
  | "deep_dive"
  | "community_pick"
  | "broadening";

export interface CuratedContentItem extends ContentItem {
  score: number;
  explanation: string;
  reason: ReasonTag;
  position: number;
  digestDate: string;
  sourceName: string;
  sourceType: string;
  sourceSlug: string;
  sourceCategory: string | null;
}

export type InteractionType = "click" | "save" | "dismiss" | "less_like_this";

export interface DigestResponse {
  items: CuratedContentItem[];
  date: string;
  total: number;
}
