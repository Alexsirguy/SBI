import { getText, type HttpOptions, SourceFetchError } from "./http";

interface Rule {
  allow: boolean;
  pattern: string;
}

interface Group {
  agents: string[];
  rules: Rule[];
  crawlDelaySeconds?: number;
}

export interface RobotsRules {
  allowed(path: string): boolean;
  crawlDelaySeconds?: number;
}

/** Parses robots.txt into the group that applies to our agent token, or the `*` group. */
export function parseRobots(text: string, agentToken: string): RobotsRules {
  const groups: Group[] = [];
  let current: Group | undefined;
  let collectingAgents = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const match = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    const field = (match[1] ?? "").toLowerCase();
    const value = (match[2] ?? "").trim();
    if (field === "user-agent") {
      if (!current || !collectingAgents) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      collectingAgents = true;
      continue;
    }
    collectingAgents = false;
    if (!current) continue;
    if (field === "allow" || field === "disallow") {
      // An empty Disallow allows everything, so it adds no rule.
      if (value) current.rules.push({ allow: field === "allow", pattern: value });
    } else if (field === "crawl-delay") {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) current.crawlDelaySeconds = seconds;
    }
  }
  const token = agentToken.toLowerCase();
  const group =
    groups.find((item) => item.agents.some((agent) => agent !== "*" && token.startsWith(agent))) ??
    groups.find((item) => item.agents.includes("*"));
  const rules = group?.rules ?? [];
  return {
    crawlDelaySeconds: group?.crawlDelaySeconds,
    allowed(path) {
      // The most specific matching rule wins; on a tie, Allow wins (RFC 9309).
      let best: Rule | undefined;
      for (const rule of rules) {
        if (!matchesPattern(rule.pattern, path)) continue;
        if (
          !best ||
          rule.pattern.length > best.pattern.length ||
          (rule.pattern.length === best.pattern.length && rule.allow)
        ) {
          best = rule;
        }
      }
      return best?.allow ?? true;
    },
  };
}

function matchesPattern(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const regex = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${regex}${anchored ? "$" : ""}`).test(path);
}

export class RobotsDisallowedError extends Error {
  constructor(url: string) {
    super(`${url} is disallowed by the site's robots.txt`);
    this.name = "RobotsDisallowedError";
  }
}

export interface PoliteFetcherOptions extends HttpOptions {
  agentToken?: string;
  /** Used when a site sets no crawl delay; keeps us from bursting any host. */
  defaultDelaySeconds?: number;
  clock?: () => number;
}

export interface PoliteFetcher {
  /** Throws RobotsDisallowedError for disallowed paths; otherwise waits its turn and fetches. */
  get(url: string, signal?: AbortSignal): ReturnType<typeof getText>;
}

/** One per process: caches each origin's robots.txt and spaces requests per host. */
export function createPoliteFetcher(options: PoliteFetcherOptions = {}): PoliteFetcher {
  const token = options.agentToken ?? "SBI-evidence";
  const wait =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const clock = options.clock ?? Date.now;
  const robots = new Map<string, Promise<RobotsRules>>();
  const nextSlot = new Map<string, number>();

  function rulesFor(origin: string, signal?: AbortSignal) {
    if (!robots.has(origin)) {
      const loaded = getText(`${origin}/robots.txt`, options, signal)
        .then((response) => parseRobots(response.text, token))
        // RFC 9309: a 4xx means no rules were published; an unreachable file means stay out.
        .catch((error: unknown) =>
          error instanceof SourceFetchError && error.status !== undefined && error.status < 500
            ? parseRobots("", token)
            : parseRobots("User-agent: *\nDisallow: /", token),
        );
      robots.set(origin, loaded);
    }
    return robots.get(origin) as Promise<RobotsRules>;
  }

  return {
    async get(url, signal) {
      const parsed = new URL(url);
      const rules = await rulesFor(parsed.origin, signal);
      if (!rules.allowed(`${parsed.pathname}${parsed.search}`))
        throw new RobotsDisallowedError(url);
      const delay = (rules.crawlDelaySeconds ?? options.defaultDelaySeconds ?? 1) * 1000;
      const slot = Math.max(clock(), nextSlot.get(parsed.host) ?? 0);
      nextSlot.set(parsed.host, slot + delay);
      if (slot > clock()) await wait(slot - clock());
      return getText(url, options, signal);
    },
  };
}
