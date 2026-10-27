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
const demo = JSON.parse(block[1]) as {
  samples: Sample[];
  topics: Record<string, { questions: string[] }>;
};

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
