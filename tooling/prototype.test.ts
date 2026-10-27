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
  steps: {
    module: string;
    title: string;
    text: Record<string, string>;
    claims: string[];
    guess?: { question: string; options: string[]; answer: number; why: Record<string, string> };
  }[];
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

  it.each(topics)("%s covers all 8 modules at three depths", (_, topic) => {
    expect([...new Set(topic.steps.map((step) => step.module))].sort()).toEqual(
      [...MODULES].sort(),
    );
    for (const step of topic.steps) {
      expect(Object.keys(step.text).sort()).toEqual(["plain", "simple", "technical"]);
      if (step.guess)
        expect(Object.keys(step.guess.why).sort()).toEqual(["plain", "simple", "technical"]);
    }
  });

  it.each(topics)(
    "%s gives the short answer, then derives it from first principles",
    (_, topic) => {
      const modules = topic.steps.map((step) => step.module);
      expect(modules.indexOf("short-answer")).toBe(1);
      expect(modules.indexOf("first-principles")).toBeLessThan(modules.indexOf("how-parts-work"));
      const reasoning = topic.steps.filter((step) =>
        ["first-principles", "how-parts-work"].includes(step.module),
      );
      expect(reasoning.length).toBeGreaterThanOrEqual(4);
      expect(reasoning.at(-1)?.title).toBe("Put it together");
    },
  );

  it.each(topics)("%s asks the learner to predict before most reveals", (_, topic) => {
    const guesses = topic.steps.flatMap((step) => step.guess ?? []);
    expect(guesses.length).toBeGreaterThanOrEqual(4);
    for (const guess of guesses) expect(guess.options[guess.answer]).toBeTruthy();
  });

  it.each(topics)("%s has a valid pre/post concept check", (_, topic) => {
    expect(topic.check.options[topic.check.answer]).toBeTruthy();
    expect(topic.check.options.at(-1)).toBe("I'm not sure");
  });

  it.each(topics)("%s traces every cited claim to a stored source", (_, topic) => {
    for (const step of topic.steps) {
      for (const claimId of step.claims) {
        const claim = topic.claims[claimId];
        expect(claim, claimId).toBeTruthy();
        for (const sourceId of claim?.sources ?? [])
          expect(topic.sources[sourceId]?.url).toMatch(/^https:\/\//);
      }
    }
    expect(topic.steps.find((step) => step.module === "history")?.claims.length).toBeGreaterThan(0);
  });
});

describe("prototype visual lab", () => {
  const glb = readFileSync(join(import.meta.dirname, "../design/prototype/gears.glb"));

  it("ships a valid, small GLB model", () => {
    expect(glb.subarray(0, 4).toString("latin1")).toBe("glTF");
    expect(glb.length).toBeLessThan(150 * 1024);
  });

  it("pins the Three.js version", () => {
    expect(html).toMatch(/"three": "https:\/\/cdn\.jsdelivr\.net\/npm\/three@\d+\.\d+\.\d+\//);
  });

  it.each(["mountSvg", "mountGlb", "mountSim", "mountLab", "buildDrivetrain"])(
    "defines %s",
    (name) => {
      expect(html).toContain(`function ${name}(`);
    },
  );

  it("opens the interactive gear lab from the lesson", () => {
    expect(html).toContain('data-action="lab">See it in action');
    expect(demo.topics.bicycle?.steps.some((step) => (step as { visual?: boolean }).visual)).toBe(
      true,
    );
  });

  it("builds the 3D gears in code when gears.glb can't load", () => {
    expect(html).toMatch(
      /catch \{\s*\/\/ Opened from disk[^\n]*\n\s*\(\{ ring, cog \} = buildDrivetrain/,
    );
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
