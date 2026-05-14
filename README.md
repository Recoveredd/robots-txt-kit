# robots-txt-kit

[![License: MPL-2.0](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](LICENSE)

Parse and evaluate `robots.txt` rules with structured diagnostics.

`robots-txt-kit` is a clean-room TypeScript draft for tools that need to inspect crawl policy without fetching files, caching domains, or depending on Node-only APIs.

## Install

```bash
npm install robots-txt-kit
```

## Quick Start

```ts
import { checkRobotsTxt, parseRobotsTxt } from "robots-txt-kit";

const robots = `
User-agent: *
Disallow: /private
Allow: /private/public
Sitemap: https://example.com/sitemap.xml
`;

const parsed = parseRobotsTxt(robots);
const decision = checkRobotsTxt(robots, "https://example.com/private/public/page", {
  userAgent: "ExampleBot"
});

console.log(parsed.document.sitemaps);
console.log(decision.allowed); // true
console.log(decision.rule?.line); // 4
```

## API

### `parseRobotsTxt(input)`

Parses a string into groups, rules, sitemaps and diagnostics. Expected problems return stable diagnostics instead of throwing.

```ts
const result = parseRobotsTxt("User-agent: *\nDisallow: /tmp");

if (result.ok) {
  console.log(result.document.groups[0]?.rules);
}
```

### `checkRobotsTxt(input, urlOrPath, options?)`

Parses and evaluates in one call. `urlOrPath` may be an absolute URL or a path beginning with `/`.

```ts
checkRobotsTxt("User-agent: *\nDisallow: /*.json$", "/feed.json");
```

### `matchRobotsTxt(document, urlOrPath, options?)`

Evaluates a pre-parsed document.

```ts
const parsed = parseRobotsTxt(robots);
const decision = matchRobotsTxt(parsed.document, "/admin", {
  userAgent: "Googlebot"
});
```

### `listRobotsTxtSitemaps(input)`

Small helper for extracting valid `Sitemap:` directives.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `userAgent` | `"*"` | User agent used to select the best group. Matching is lowercase and substring-based. |
| `defaultAllowed` | `true` | Decision when no matching group or rule exists. |

## Diagnostics

Diagnostics are objects with stable `code` values and optional line numbers:

- `invalid-input`
- `empty-input`
- `missing-colon`
- `empty-directive`
- `empty-user-agent`
- `rule-before-user-agent`
- `unsupported-directive`
- `invalid-crawl-delay`
- `invalid-url`

## Scope

The MVP supports:

- `User-agent`, `Allow`, `Disallow`, `Sitemap` and `Crawl-delay`;
- grouped adjacent `User-agent` lines;
- merging rules from multiple groups with the same best matching user-agent;
- wildcard `*` and end-anchor `$` path matching;
- most-specific rule selection, with `Allow` winning specificity ties;
- browser, worker and build-tool usage with no runtime dependencies.

It intentionally does not fetch remote `robots.txt` files, cache domains, implement every crawler-specific extension, ship a public suffix list, or replace crawler-specific validators. Treat it as a portable inspector for local policy checks.

## License

MPL-2.0
