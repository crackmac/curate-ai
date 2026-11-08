import { afterEach, describe, expect, it, vi } from "vitest";
import { combinedFeedUrl, rateLimitWaitMs, splitBySubreddit } from "./reddit";

const post = (subreddit: string, id: string) => ({
  title: `Post ${id}`,
  link: `https://www.reddit.com/r/${subreddit}/comments/${id}/some_title/`,
});

describe("combinedFeedUrl", () => {
  it("joins subreddits with + into one hot feed at Reddit's max page size", () => {
    expect(combinedFeedUrl(["programming", "typescript", "devops"])).toBe(
      "https://www.reddit.com/r/programming+typescript+devops/hot/.rss?limit=100",
    );
  });
});

describe("splitBySubreddit", () => {
  it("assigns each entry to the subreddit in its permalink, in feed order", () => {
    const entries = [
      post("programming", "a"),
      post("devops", "b"),
      post("programming", "c"),
    ];
    const split = splitBySubreddit(entries, ["programming", "devops"]);
    expect(split.get("programming")!.map((e) => e.title)).toEqual(["Post a", "Post c"]);
    expect(split.get("devops")!.map((e) => e.title)).toEqual(["Post b"]);
  });

  it("matches case-insensitively and keys by the configured name", () => {
    // Sources are configured as e.g. "MachineLearning"; links may differ in case.
    const split = splitBySubreddit(
      [post("machinelearning", "a"), post("CFB", "b")],
      ["MachineLearning", "cfb"],
    );
    expect(split.get("MachineLearning")).toHaveLength(1);
    expect(split.get("cfb")).toHaveLength(1);
  });

  it("returns an empty list for a requested subreddit with no entries", () => {
    const split = splitBySubreddit([post("programming", "a")], ["programming", "typescript"]);
    expect(split.get("typescript")).toEqual([]);
  });

  it("drops entries for subreddits that weren't requested or have no link", () => {
    const entries: { title: string; link?: string }[] = [
      post("pics", "a"),
      { title: "no link" },
      post("programming", "b"),
    ];
    const split = splitBySubreddit(entries, ["programming"]);
    expect([...split.keys()]).toEqual(["programming"]);
    expect(split.get("programming")!.map((e) => e.title)).toEqual(["Post b"]);
  });

  it("does not match a subreddit that merely shares a prefix", () => {
    const split = splitBySubreddit([post("nbadiscussion", "a")], ["nba"]);
    expect(split.get("nba")).toEqual([]);
  });

  it("caps each subreddit at 25 entries", () => {
    const entries = Array.from({ length: 40 }, (_, i) => post("nfl", String(i)));
    expect(splitBySubreddit(entries, ["nfl"]).get("nfl")).toHaveLength(25);
  });
});

describe("rateLimitWaitMs", () => {
  it("waits for the reset window, plus a second, once no requests remain", () => {
    expect(rateLimitWaitMs("0.0", "25")).toBe(26_000);
  });

  it("does not wait while requests remain", () => {
    expect(rateLimitWaitMs("99.0", "25")).toBe(0);
  });

  it("does not wait when the headers are missing or malformed", () => {
    expect(rateLimitWaitMs(null, null)).toBe(0);
    expect(rateLimitWaitMs("0", "soon")).toBe(0);
  });

  it("caps very long waits at two minutes", () => {
    expect(rateLimitWaitMs("0", "3600")).toBe(120_000);
  });
});

function atomFeed(entries: { title: string; link: string }[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>combined</title>
  ${entries
    .map(
      (e, i) => `<entry>
    <id>t3_${i}</id>
    <title>${e.title}</title>
    <link href="${e.link}" />
    <updated>2026-11-07T12:00:00+00:00</updated>
    <content type="html">&lt;p&gt;body ${i}&lt;/p&gt;</content>
  </entry>`,
    )
    .join("\n")}
</feed>`;
}

describe("fetchSubreddits", () => {
  // Fresh module per test: the rate-limit pacing state is module-level.
  const loadFetchSubreddits = async () => {
    vi.resetModules();
    return (await import("./reddit")).fetchSubreddits;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("makes one request for all subreddits and splits the items back out", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        atomFeed([post("programming", "a"), post("devops", "b"), post("programming", "c")]),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const fetchSubreddits = await loadFetchSubreddits();

    const result = await fetchSubreddits(["programming", "typescript", "devops"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]).toEqual([
      "https://www.reddit.com/r/programming+typescript+devops/hot/.rss?limit=100",
      expect.anything(),
    ]);
    expect(result.get("programming")!.map((i) => i.title)).toEqual(["Post a", "Post c"]);
    expect(result.get("typescript")).toEqual([]);
    const [devopsItem] = result.get("devops")!;
    expect(devopsItem).toMatchObject({
      type: "article",
      title: "Post b",
      url: post("devops", "b").link,
      summary: "body 1",
      metadata: { subreddit: "devops", redditUrl: post("devops", "b").link },
    });
  });

  it("waits for Reddit's rate-limit reset before the next request", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () =>
      new Response(atomFeed([post("nba", "a")]), {
        status: 200,
        headers: { "x-ratelimit-remaining": "0.0", "x-ratelimit-reset": "25" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const fetchSubreddits = await loadFetchSubreddits();

    await fetchSubreddits(["nba"]);
    const second = fetchSubreddits(["movies"]);

    await vi.advanceTimersByTimeAsync(25_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await second;
  });

  it("reports a 429 as an error", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    const fetchSubreddits = await loadFetchSubreddits();
    const pending = fetchSubreddits(["nba"]);
    const assertion = expect(pending).rejects.toThrow("Status code 429");
    await vi.runAllTimersAsync();
    await assertion;
  });
});
