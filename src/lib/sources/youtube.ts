import type { SourceAdapter, RawContentItem, SourceConfig } from "./types";

const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: {
      medium?: { url: string };
      high?: { url: string };
    };
  };
}

interface YouTubeVideoItem {
  id: string;
  contentDetails: {
    duration: string;
  };
  statistics: {
    viewCount: string;
    likeCount?: string;
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchYouTubeJson(url: string): Promise<Response> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res;

    const retryable = res.status === 429 || res.status >= 500;
    const isLastAttempt = attempt === maxAttempts;

    if (!retryable || isLastAttempt) {
      return res;
    }

    const retryAfter = Number(res.headers.get("retry-after"));
    const delayMs =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 2000 * attempt;
    await sleep(delayMs);
  }

  return fetch(url);
}

async function resolveChannelId(
  input: string,
  apiKey: string,
): Promise<string | null> {
  if (input.startsWith("UC") && !input.includes("/")) return input;

  const handleMatch = input.match(/@([\w.-]+)/);
  if (handleMatch) {
    const res = await fetchYouTubeJson(
      `${YOUTUBE_API}/channels?` +
        new URLSearchParams({
          key: apiKey,
          forHandle: handleMatch[1],
          part: "id",
        }),
    );
    if (res.ok) {
      const data = await res.json();
      if (data.items?.[0]?.id) return data.items[0].id;
    }
  }

  const usernameMatch = input.match(/\/(?:c|user)\/([\w.-]+)/);
  if (usernameMatch) {
    const res = await fetchYouTubeJson(
      `${YOUTUBE_API}/channels?` +
        new URLSearchParams({
          key: apiKey,
          forUsername: usernameMatch[1],
          part: "id",
        }),
    );
    if (res.ok) {
      const data = await res.json();
      if (data.items?.[0]?.id) return data.items[0].id;
    }
  }

  return null;
}

export const youtubeAdapter: SourceAdapter = {
  id: "youtube",

  async fetch(config: SourceConfig): Promise<RawContentItem[]> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new Error("YOUTUBE_API_KEY is required");

    const rawChannelId = config.channelId as string | undefined;
    if (!rawChannelId) return [];

    const channelId = await resolveChannelId(rawChannelId, apiKey);
    if (!channelId)
      throw new Error(`Could not resolve channel: ${rawChannelId}`);

    const searchRes = await fetchYouTubeJson(
      `${YOUTUBE_API}/search?` +
        new URLSearchParams({
          key: apiKey,
          channelId,
          part: "snippet",
          order: "date",
          maxResults: "10",
          type: "video",
        }),
    );

    if (!searchRes.ok)
      throw new Error(`YouTube search error: ${searchRes.status}`);

    const searchData = await searchRes.json();
    const searchItems: YouTubeSearchItem[] = searchData.items || [];

    if (searchItems.length === 0) return [];

    const videoIds = searchItems.map((item) => item.id.videoId).join(",");
    const detailsRes = await fetchYouTubeJson(
      `${YOUTUBE_API}/videos?` +
        new URLSearchParams({
          key: apiKey,
          id: videoIds,
          part: "contentDetails,statistics",
        }),
    );

    const detailsData = detailsRes.ok ? await detailsRes.json() : { items: [] };
    const detailsMap = new Map<string, YouTubeVideoItem>();
    for (const item of detailsData.items || []) {
      detailsMap.set(item.id, item);
    }

    const items: RawContentItem[] = [];

    for (const item of searchItems) {
      const videoId = item.id.videoId;
      const details = detailsMap.get(videoId);
      const duration = details?.contentDetails?.duration || "";
      const isShort = isShortVideo(duration);

      items.push({
        externalId: videoId,
        type: isShort ? "short" : "video",
        title: decodeHtmlEntities(item.snippet.title),
        summary: item.snippet.description.slice(0, 300) || undefined,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        author: item.snippet.channelTitle,
        thumbnailUrl:
          item.snippet.thumbnails.high?.url ||
          item.snippet.thumbnails.medium?.url,
        publishedAt: item.snippet.publishedAt,
        metadata: {
          channelId,
          duration,
          viewCount: parseInt(details?.statistics?.viewCount || "0", 10),
          likeCount: parseInt(details?.statistics?.likeCount || "0", 10),
          isShort,
        },
      });
    }

    return items;
  },
};

function isShortVideo(isoDuration: string): boolean {
  const match = isoDuration.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return false;
  const minutes = parseInt(match[1] || "0", 10);
  const seconds = parseInt(match[2] || "0", 10);
  return minutes === 0 && seconds <= 60;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
