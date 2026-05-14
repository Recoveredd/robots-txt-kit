import { describe, expect, it } from "vitest";
import {
  checkRobotsTxt,
  listRobotsTxtSitemaps,
  matchRobotsTxt,
  parseRobotsTxt
} from "../src/index.js";

const fixture = `# crawl policy
User-agent: *
Disallow: /private
Allow: /private/public
Crawl-delay: 2.5

User-agent: Googlebot
Disallow: /nogoogle
Allow: /nogoogle/news$

Sitemap: https://example.com/sitemap.xml
`;

describe("parseRobotsTxt", () => {
  it("parses groups, rules, crawl delay and sitemap directives", () => {
    const result = parseRobotsTxt(fixture);

    expect(result.ok).toBe(true);
    expect(result.document.groups).toHaveLength(2);
    expect(result.document.groups[0]).toMatchObject({
      agents: ["*"],
      crawlDelay: 2.5,
      rules: [
        { type: "disallow", path: "/private", line: 3 },
        { type: "allow", path: "/private/public", line: 4 }
      ]
    });
    expect(result.document.sitemaps).toEqual([
      { url: "https://example.com/sitemap.xml", line: 11 }
    ]);
  });

  it("keeps adjacent user-agent lines in one group", () => {
    const result = parseRobotsTxt(`User-agent: Googlebot\nUser-agent: Bingbot\nDisallow: /tmp`);

    expect(result.document.groups).toHaveLength(1);
    expect(result.document.groups[0]?.agents).toEqual(["googlebot", "bingbot"]);
  });

  it("reports invalid and empty input without throwing", () => {
    expect(parseRobotsTxt(null)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "invalid-input" }]
    });
    expect(parseRobotsTxt("  \n ")).toMatchObject({
      ok: false,
      diagnostics: [{ code: "empty-input" }]
    });
  });

  it("reports malformed and unsupported directives with stable codes", () => {
    const result = parseRobotsTxt(`Disallow: /orphan\nUser-agent\nUser-agent: *\nNoindex: /old`);

    expect(result.diagnostics.map((entry) => entry.code)).toEqual([
      "rule-before-user-agent",
      "missing-colon",
      "unsupported-directive"
    ]);
  });

  it("reports invalid crawl-delay and sitemap URLs", () => {
    const result = parseRobotsTxt(`User-agent: *\nCrawl-delay: nope\nSitemap: /relative.xml`);

    expect(result.diagnostics.map((entry) => entry.code)).toEqual([
      "invalid-crawl-delay",
      "invalid-url"
    ]);
  });
});

describe("matchRobotsTxt", () => {
  it("applies the most specific matching rule", () => {
    expect(checkRobotsTxt(fixture, "/private/report").allowed).toBe(false);
    expect(checkRobotsTxt(fixture, "/private/public/page").allowed).toBe(true);
  });

  it("prefers the most specific user-agent group", () => {
    const denied = checkRobotsTxt(fixture, "https://example.com/nogoogle", {
      userAgent: "Googlebot-News"
    });
    const allowed = checkRobotsTxt(fixture, "https://example.com/nogoogle/news", {
      userAgent: "Googlebot-News"
    });

    expect(denied).toMatchObject({
      allowed: false,
      path: "/nogoogle",
      rule: { type: "disallow" }
    });
    expect(allowed).toMatchObject({
      allowed: true,
      path: "/nogoogle/news",
      rule: { type: "allow" }
    });
  });

  it("combines rules from groups with the same best matching user-agent", () => {
    const robots = `User-agent: Googlebot
Disallow: /a

User-agent: *
Disallow: /fallback

User-agent: googlebot
Allow: /a/public
Disallow: /b
`;

    const combined = checkRobotsTxt(robots, "/a/public/page", {
      userAgent: "Googlebot-News"
    });
    const denied = checkRobotsTxt(robots, "/b", {
      userAgent: "Googlebot-News"
    });
    const fallback = checkRobotsTxt(robots, "/fallback", {
      userAgent: "OtherBot"
    });

    expect(combined.allowed).toBe(true);
    expect(combined.group?.sourceGroups).toEqual([0, 2]);
    expect(denied.allowed).toBe(false);
    expect(denied.rule).toMatchObject({ type: "disallow", path: "/b" });
    expect(fallback.allowed).toBe(false);
    expect(fallback.group?.sourceGroups).toBeUndefined();
  });

  it("uses the longest matching user-agent group without mixing the wildcard fallback", () => {
    const robots = `User-agent: *
Disallow: /

User-agent: Googlebot
Allow: /news

User-agent: Googlebot-News
Disallow: /news/private
`;

    const result = checkRobotsTxt(robots, "/news/private/story", {
      userAgent: "Googlebot-News"
    });

    expect(result.allowed).toBe(false);
    expect(result.group?.agents).toEqual(["googlebot-news"]);
    expect(result.rule).toMatchObject({ path: "/news/private" });
  });

  it("lets allow win when specificity is tied", () => {
    const result = checkRobotsTxt(`User-agent: *\nDisallow: /feed\nAllow: /feed`, "/feed");

    expect(result.allowed).toBe(true);
  });

  it("supports wildcard and end-anchor patterns", () => {
    const robots = `User-agent: *\nDisallow: /*.json$\nAllow: /public/*.json$`;

    expect(checkRobotsTxt(robots, "/data/file.json").allowed).toBe(false);
    expect(checkRobotsTxt(robots, "/data/file.json?x=1").allowed).toBe(true);
    expect(checkRobotsTxt(robots, "/public/file.json").allowed).toBe(true);
  });

  it("treats empty Allow and Disallow values as no-op rules", () => {
    const robots = `User-agent: *
Disallow:
Allow:
Disallow: /blocked`;

    expect(checkRobotsTxt(robots, "/").allowed).toBe(true);
    expect(checkRobotsTxt(robots, "/blocked").allowed).toBe(false);
  });

  it("reports non-string URL inputs without throwing", () => {
    const result = checkRobotsTxt("User-agent: *\nDisallow: /", null);

    expect(result.path).toBe("/");
    expect(result.allowed).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-url" })
    );
  });

  it("can match a pre-parsed document and custom default", () => {
    const parsed = parseRobotsTxt("User-agent: ExampleBot\nDisallow: /blocked");
    const result = matchRobotsTxt(parsed.document, "/free", {
      userAgent: "OtherBot",
      defaultAllowed: false
    });

    expect(result.allowed).toBe(false);
    expect(result.rule).toBeUndefined();
  });

  it("returns sitemap helpers for quick inspection", () => {
    expect(listRobotsTxtSitemaps(fixture)).toEqual([
      { url: "https://example.com/sitemap.xml", line: 11 }
    ]);
  });
});
