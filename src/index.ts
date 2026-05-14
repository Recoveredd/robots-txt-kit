export type RobotsTxtDiagnosticCode =
  | "invalid-input"
  | "empty-input"
  | "missing-colon"
  | "empty-directive"
  | "empty-user-agent"
  | "rule-before-user-agent"
  | "unsupported-directive"
  | "invalid-crawl-delay"
  | "invalid-url";

export type RobotsTxtDiagnostic = {
  code: RobotsTxtDiagnosticCode;
  message: string;
  line?: number;
  directive?: string;
};

export type RobotsTxtRuleType = "allow" | "disallow";

export type RobotsTxtRule = {
  type: RobotsTxtRuleType;
  path: string;
  line: number;
  pattern: string;
  specificity: number;
};

export type RobotsTxtGroup = {
  agents: string[];
  rules: RobotsTxtRule[];
  crawlDelay?: number;
  lines: number[];
};

export type RobotsTxtSitemap = {
  url: string;
  line: number;
};

export type RobotsTxtDocument = {
  groups: RobotsTxtGroup[];
  sitemaps: RobotsTxtSitemap[];
  diagnostics: RobotsTxtDiagnostic[];
};

export type ParseRobotsTxtResult =
  | {
      ok: true;
      document: RobotsTxtDocument;
      diagnostics: RobotsTxtDiagnostic[];
    }
  | {
      ok: false;
      document: RobotsTxtDocument;
      diagnostics: RobotsTxtDiagnostic[];
    };

export type RobotsTxtMatch = {
  allowed: boolean;
  userAgent: string;
  path: string;
  group?: RobotsTxtGroup;
  rule?: RobotsTxtRule;
  diagnostics: RobotsTxtDiagnostic[];
};

export type CheckRobotsTxtOptions = {
  userAgent?: string;
  defaultAllowed?: boolean;
};

const supportedDirectives = new Set([
  "user-agent",
  "allow",
  "disallow",
  "sitemap",
  "crawl-delay"
]);

export function parseRobotsTxt(input: unknown): ParseRobotsTxtResult {
  const emptyDocument = createDocument();

  if (typeof input !== "string") {
    const diagnostics = [
      diagnostic("invalid-input", "robots.txt input must be a string.")
    ];
    return { ok: false, document: emptyDocument, diagnostics };
  }

  if (input.trim().length === 0) {
    const diagnostics = [diagnostic("empty-input", "robots.txt input is empty.")];
    return { ok: false, document: emptyDocument, diagnostics };
  }

  const document = createDocument();
  let currentGroup: RobotsTxtGroup | undefined;
  let lastDirectiveWasUserAgent = false;
  const lines = input.replace(/\r\n?/g, "\n").split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const rawLine = stripComment(lines[index] ?? "").trim();

    if (rawLine.length === 0) continue;

    const separatorIndex = rawLine.indexOf(":");
    if (separatorIndex === -1) {
      document.diagnostics.push(
        diagnostic("missing-colon", "Directive line is missing a colon.", lineNumber)
      );
      continue;
    }

    const rawDirective = rawLine.slice(0, separatorIndex).trim();
    const value = rawLine.slice(separatorIndex + 1).trim();
    const directive = rawDirective.toLowerCase();

    if (directive.length === 0) {
      document.diagnostics.push(
        diagnostic("empty-directive", "Directive name is empty.", lineNumber)
      );
      continue;
    }

    if (!supportedDirectives.has(directive)) {
      document.diagnostics.push(
        diagnostic(
          "unsupported-directive",
          `Unsupported directive "${rawDirective}" was ignored.`,
          lineNumber,
          rawDirective
        )
      );
      lastDirectiveWasUserAgent = false;
      continue;
    }

    if (directive === "sitemap") {
      if (isLikelyUrl(value)) {
        document.sitemaps.push({ url: value, line: lineNumber });
      } else {
        document.diagnostics.push(
          diagnostic("invalid-url", "Sitemap directive must contain an absolute URL.", lineNumber)
        );
      }
      lastDirectiveWasUserAgent = false;
      continue;
    }

    if (directive === "user-agent") {
      const agent = normalizeAgent(value);
      if (!agent) {
        document.diagnostics.push(
          diagnostic("empty-user-agent", "User-agent directive has no value.", lineNumber)
        );
        continue;
      }

      if (!currentGroup || !lastDirectiveWasUserAgent || currentGroup.rules.length > 0) {
        currentGroup = { agents: [], rules: [], lines: [] };
        document.groups.push(currentGroup);
      }

      currentGroup.agents.push(agent);
      currentGroup.lines.push(lineNumber);
      lastDirectiveWasUserAgent = true;
      continue;
    }

    lastDirectiveWasUserAgent = false;

    if (!currentGroup) {
      document.diagnostics.push(
        diagnostic(
          "rule-before-user-agent",
          "Rule directive appeared before any user-agent group.",
          lineNumber,
          directive
        )
      );
      continue;
    }

    currentGroup.lines.push(lineNumber);

    if (directive === "crawl-delay") {
      const delay = Number(value);
      if (!Number.isFinite(delay) || delay < 0) {
        document.diagnostics.push(
          diagnostic("invalid-crawl-delay", "Crawl-delay must be a non-negative number.", lineNumber)
        );
      } else {
        currentGroup.crawlDelay = delay;
      }
      continue;
    }

    currentGroup.rules.push({
      type: directive as RobotsTxtRuleType,
      path: value,
      line: lineNumber,
      pattern: value,
      specificity: calculateSpecificity(value)
    });
  }

  return {
    ok: !document.diagnostics.some((entry) =>
      ["invalid-input", "empty-input", "missing-colon", "empty-directive"].includes(entry.code)
    ),
    document,
    diagnostics: document.diagnostics
  };
}

export function checkRobotsTxt(
  input: unknown,
  urlOrPath: string,
  options: CheckRobotsTxtOptions = {}
): RobotsTxtMatch {
  const parsed = parseRobotsTxt(input);
  const matchOptions: CheckRobotsTxtOptions & { diagnostics: RobotsTxtDiagnostic[] } = {
    diagnostics: parsed.diagnostics
  };
  if (options.userAgent !== undefined) matchOptions.userAgent = options.userAgent;
  if (options.defaultAllowed !== undefined) {
    matchOptions.defaultAllowed = options.defaultAllowed;
  }
  return matchRobotsTxt(parsed.document, urlOrPath, matchOptions);
}

export function matchRobotsTxt(
  document: RobotsTxtDocument,
  urlOrPath: string,
  options: CheckRobotsTxtOptions & { diagnostics?: RobotsTxtDiagnostic[] } = {}
): RobotsTxtMatch {
  const diagnostics = [...(options.diagnostics ?? [])];
  const userAgent = normalizeAgent(options.userAgent ?? "*") ?? "*";
  const path = normalizePath(urlOrPath, diagnostics);
  const group = selectGroup(document.groups, userAgent);
  const defaultAllowed = options.defaultAllowed ?? true;

  if (!group) {
    return { allowed: defaultAllowed, userAgent, path, diagnostics };
  }

  const rule = selectRule(group.rules, path);
  if (!rule) {
    return { allowed: defaultAllowed, userAgent, path, group, diagnostics };
  }

  return {
    allowed: rule.type === "allow",
    userAgent,
    path,
    group,
    rule,
    diagnostics
  };
}

export function listRobotsTxtSitemaps(input: unknown): RobotsTxtSitemap[] {
  return parseRobotsTxt(input).document.sitemaps;
}

function createDocument(): RobotsTxtDocument {
  return { groups: [], sitemaps: [], diagnostics: [] };
}

function diagnostic(
  code: RobotsTxtDiagnosticCode,
  message: string,
  line?: number,
  directive?: string
): RobotsTxtDiagnostic {
  const result: RobotsTxtDiagnostic = { code, message };
  if (line !== undefined) result.line = line;
  if (directive !== undefined) result.directive = directive;
  return result;
}

function stripComment(line: string): string {
  const hashIndex = line.indexOf("#");
  return hashIndex === -1 ? line : line.slice(0, hashIndex);
}

function normalizeAgent(value: string): string | undefined {
  const agent = value.trim().toLowerCase();
  return agent.length > 0 ? agent : undefined;
}

function normalizePath(urlOrPath: string, diagnostics: RobotsTxtDiagnostic[]): string {
  if (urlOrPath.startsWith("/")) return urlOrPath;

  try {
    const url = new URL(urlOrPath);
    return `${url.pathname}${url.search}`;
  } catch {
    diagnostics.push(
      diagnostic("invalid-url", "URL input was not absolute, so it was treated as a path.")
    );
    return urlOrPath.length > 0 ? urlOrPath : "/";
  }
}

function selectGroup(groups: RobotsTxtGroup[], userAgent: string): RobotsTxtGroup | undefined {
  let selected: { group: RobotsTxtGroup; score: number } | undefined;

  for (const group of groups) {
    const score = Math.max(...group.agents.map((agent) => agentMatchScore(agent, userAgent)));
    if (score < 0) continue;
    if (!selected || score > selected.score) selected = { group, score };
  }

  return selected?.group;
}

function agentMatchScore(agent: string, userAgent: string): number {
  if (agent === "*") return 0;
  return userAgent.includes(agent) ? agent.length : -1;
}

function selectRule(rules: RobotsTxtRule[], path: string): RobotsTxtRule | undefined {
  let selected: RobotsTxtRule | undefined;

  for (const rule of rules) {
    if (rule.path === "") continue;
    if (!matchesRobotsPattern(rule.pattern, path)) continue;
    if (!selected || compareRules(rule, selected) > 0) selected = rule;
  }

  return selected;
}

function compareRules(left: RobotsTxtRule, right: RobotsTxtRule): number {
  if (left.specificity !== right.specificity) return left.specificity - right.specificity;
  if (left.type === right.type) return 0;
  return left.type === "allow" ? 1 : -1;
}

function matchesRobotsPattern(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const source = body
    .split("*")
    .map(escapeRegExp)
    .join(".*");
  const expression = new RegExp(`^${source}${anchored ? "$" : ""}`);
  return expression.test(path);
}

function calculateSpecificity(pattern: string): number {
  return pattern.replace(/\*/g, "").replace(/\$$/, "").length;
}

function isLikelyUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
