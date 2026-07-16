import { describe, it, expect } from "vitest";
import { stripHtml, extractImageFromContent } from "./rss";

describe("stripHtml", () => {
  it("removes tags and collapses whitespace", () => {
    expect(stripHtml("<p>Hello   <b>world</b></p>\n<span>!</span>")).toBe(
      "Hello world !"
    );
  });

  it("returns empty string for empty input", () => {
    expect(stripHtml("")).toBe("");
  });
});

describe("extractImageFromContent", () => {
  it("returns undefined when there is no img", () => {
    expect(extractImageFromContent("<p>no image here</p>")).toBeUndefined();
  });

  it("extracts a plain image src", () => {
    expect(
      extractImageFromContent('<img src="https://example.com/a.jpg"> text')
    ).toBe("https://example.com/a.jpg");
  });

  // Regression: feed content is HTML-escaped, so &amp; in signed Reddit image
  // URLs must be decoded or the query string (and signature) is corrupted.
  it("decodes &amp; entities so signed URLs stay valid", () => {
    const html =
      '<img src="https://external-preview.redd.it/x.png?width=640&amp;crop=smart&amp;s=abc123">';
    expect(extractImageFromContent(html)).toBe(
      "https://external-preview.redd.it/x.png?width=640&crop=smart&s=abc123"
    );
  });
});
