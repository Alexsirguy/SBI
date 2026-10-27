import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const html = readFileSync(join(import.meta.dirname, "../design/prototype/index.html"), "utf8");
const block = html.match(/<script type="application\/json" id="demo-data">([\s\S]*?)<\/script>/);
if (!block?.[1]) throw new Error("prototype is missing its demo-data block");

interface Sample {
  id: string;
  path: string;
  recognition: {
    status: string;
    candidates: { label: string; topic?: string }[];
    redirect?: string;
  };
}
interface Topic {
  questions: string[];
  check: { question: string; options: string[]; answer: number; explain: string };
  modules: Record<string, { text: Record<string, string>; claims: string[]; reveal?: string }>;
  claims: Record<string, { text: string; sources: string[] }>;
  sources: Record<string, { title: string; publisher: string; url: string }>;
}
const demo = JSON.parse(block[1]) as { samples: Sample[]; topics: Record<string, Topic> };

const MODULES = [
  "what-youre-seeing",
  "short-answer",
  "first-principles",
  "how-parts-work",
  "try-an-idea",
  "history",
  "check-thinking",
  "go-further",
];
const topics = Object.entries(demo.topics);

describe("prototype lessons", () => {
  it("has at least three topics", () => {
    expect(topics.length).toBeGreaterThanOrEqual(3);
  });

  it.each(topics)("%s has all 8 modules at three depths", (_, topic) => {
    expect(Object.keys(topic.modules).sort()).toEqual([...MODULES].sort());
    for (const module of Object.values(topic.modules)) {
      expect(Object.keys(module.text).sort()).toEqual(["plain", "simple", "technical"]);
    }
  });

  it.each(topics)("%s has a valid pre/post concept check", (_, topic) => {
    expect(topic.check.options[topic.check.answer]).toBeTruthy();
    expect(topic.check.options.at(-1)).toBe("I'm not sure");
  });

  it.each(topics)("%s traces every cited claim to a stored source", (_, topic) => {
    for (const module of Object.values(topic.modules)) {
      for (const claimId of module.claims) {
        const claim = topic.claims[claimId];
        expect(claim, claimId).toBeTruthy();
        for (const sourceId of claim?.sources ?? [])
          expect(topic.sources[sourceId]?.url).toMatch(/^https:\/\//);
      }
    }
    expect(topic.modules.history?.claims.length).toBeGreaterThan(0);
  });
});

describe("prototype demo data", () => {
  it.each(["confident", "ambiguous", "unsupported"])("has a %s sample", (path) => {
    expect(demo.samples.some((sample) => sample.path === path)).toBe(true);
  });

  it("gives ambiguous samples several candidates and unsupported samples a redirect", () => {
    for (const sample of demo.samples) {
      if (sample.path === "ambiguous")
        expect(sample.recognition.candidates.length).toBeGreaterThan(1);
      if (sample.path === "unsupported") {
        expect(sample.recognition.candidates).toHaveLength(0);
        expect(sample.recognition.redirect).toBeTruthy();
      }
    }
  });

  it("links every candidate topic to a topic with questions", () => {
    const topics = demo.samples.flatMap((sample) =>
      sample.recognition.candidates.flatMap((candidate) => candidate.topic ?? []),
    );
    for (const topic of topics) expect(demo.topics[topic]?.questions.length).toBeGreaterThan(0);
  });

  it("never loads scripts from outside the allowed CDNs", () => {
    const sources = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1]);
    for (const src of sources)
      expect(src).toMatch(/^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//);
  });
});
