import { describe, expect, it, vi } from "vitest";
import { createPoliteFetcher, parseRobots, RobotsDisallowedError } from "./robots";

describe("parseRobots", () => {
  const text = [
    "User-agent: GPTBot",
    "Disallow: /",
    "",
    "User-agent: *",
    "Crawl-delay: 10",
    "Disallow: /search",
    "Disallow: /*/print$",
    "Allow: /search/help",
  ].join("\n");

  it("applies the * group when no group names our agent", () => {
    const rules = parseRobots(text, "SBI-evidence");
    expect(rules.crawlDelaySeconds).toBe(10);
    expect(rules.allowed("/science/water")).toBe(true);
    expect(rules.allowed("/search?q=boil")).toBe(false);
    expect(rules.allowed("/search/help")).toBe(true);
    expect(rules.allowed("/guide/print")).toBe(false);
    expect(rules.allowed("/guide/printable")).toBe(true);
  });

  it("uses a group that names our agent instead of the * group", () => {
    const rules = parseRobots(
      `${text}\n\nUser-agent: SBI-evidence\nDisallow: /private`,
      "SBI-evidence",
    );
    expect(rules.allowed("/search")).toBe(true);
    expect(rules.allowed("/private/x")).toBe(false);
  });

  it("allows everything when nothing applies", () => {
    expect(parseRobots("", "SBI-evidence").allowed("/anything")).toBe(true);
    expect(parseRobots("User-agent: GPTBot\nDisallow: /", "SBI-evidence").allowed("/x")).toBe(true);
  });
});

describe("createPoliteFetcher", () => {
  function site(robots: Response | (() => Response), page = "<p>ok</p>") {
    return vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const response = url.endsWith("/robots.txt")
        ? typeof robots === "function"
          ? robots()
          : robots.clone()
        : new Response(page);
      Object.defineProperty(response, "url", { value: url });
      return response;
    });
  }
  const options = { sleep: async () => undefined, retryDelayMs: 1 };

  it("refuses paths robots.txt disallows, and caches robots per origin", async () => {
    const fetchImpl = site(new Response("User-agent: *\nDisallow: /private"));
    const fetcher = createPoliteFetcher({ ...options, fetchImpl });
    await expect(fetcher.get("https://example.gov/private/page")).rejects.toBeInstanceOf(
      RobotsDisallowedError,
    );
    expect((await fetcher.get("https://example.gov/public/page")).text).toBe("<p>ok</p>");
    const robotsCalls = fetchImpl.mock.calls.filter(([url]) => String(url).endsWith("robots.txt"));
    expect(robotsCalls).toHaveLength(1);
  });

  it("treats a missing robots.txt as no restrictions", async () => {
    const fetcher = createPoliteFetcher({
      ...options,
      fetchImpl: site(() => new Response("gone", { status: 404 })),
    });
    expect((await fetcher.get("https://example.gov/page")).text).toBe("<p>ok</p>");
  });

  it("stays out when robots.txt cannot be read because the server fails", async () => {
    const fetcher = createPoliteFetcher({
      ...options,
      fetchImpl: site(() => new Response("down", { status: 503 })),
    });
    await expect(fetcher.get("https://example.gov/page")).rejects.toBeInstanceOf(
      RobotsDisallowedError,
    );
  });

  it("spaces requests to one host by its crawl delay and leaves other hosts alone", async () => {
    let now = 0;
    const sleep = vi.fn(async (ms: number) => {
      now += ms;
    });
    const fetcher = createPoliteFetcher({
      fetchImpl: site(new Response("User-agent: *\nCrawl-delay: 30")),
      sleep,
      clock: () => now,
    });
    await fetcher.get("https://www.fda.gov/a");
    await fetcher.get("https://www.fda.gov/b");
    await fetcher.get("https://www.eia.gov/c");
    expect(sleep.mock.calls).toEqual([[30_000]]);
  });
});
