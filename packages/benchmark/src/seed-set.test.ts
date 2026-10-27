import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadSeedSet, SEED_SET_PATH, SEED_SET_PATHS, SeedSet, SteamCategory } from "./seed-set";

const set = loadSeedSet();
const raw = JSON.parse(readFileSync(SEED_SET_PATH, "utf8"));
const tagged = (tag: string) => set.prompts.filter((prompt) => prompt.tags.includes(tag as never));

describe("seed set (latest)", () => {
  it("has at least 30 prompts", () => {
    expect(set.prompts.length).toBeGreaterThanOrEqual(30);
  });

  it.each(SteamCategory.options)("covers %s with at least 5 prompts", (category) => {
    expect(
      set.prompts.filter((prompt) => prompt.category === category).length,
    ).toBeGreaterThanOrEqual(5);
  });

  it.each(["ambiguous-photo", "unsupported", "misconception", "high-risk", "paraphrase"])(
    "includes %s prompts",
    (tag) => {
      expect(tagged(tag).length).toBeGreaterThanOrEqual(3);
    },
  );

  it("expects ambiguous photos to be flagged rather than labelled confidently", () => {
    const photos = tagged("ambiguous-photo").filter((prompt) => prompt.image);
    expect(photos.every((prompt) => prompt.expected.recognition !== "confident")).toBe(true);
  });

  it("never expects high-risk prompts to be answered as normal", () => {
    expect(tagged("high-risk").every((prompt) => prompt.expected.safety !== "allow")).toBe(true);
  });

  it("gives every image a pinned hash and a rights record", () => {
    for (const prompt of set.prompts.filter((candidate) => candidate.image)) {
      expect(prompt.image?.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(prompt.image?.rights.license).toBeTruthy();
      expect(prompt.image?.rights.author).toBeTruthy();
    }
  });

  it("records a people review for every image and shows no faces", () => {
    for (const prompt of set.prompts.filter((candidate) => candidate.image)) {
      expect(prompt.image?.peopleVisible, prompt.id).toMatch(/^(none|hands-only)$/);
    }
  });

  it("keeps every released version loadable", () => {
    for (const [version, path] of Object.entries(SEED_SET_PATHS)) {
      expect(loadSeedSet(path).version).toBe(version);
    }
  });

  it("rejects a paraphrase pointing at an unknown prompt", () => {
    const broken = structuredClone(raw);
    broken.prompts.find((prompt: { paraphraseOf?: string }) => prompt.paraphraseOf).paraphraseOf =
      "seed-999";
    expect(SeedSet.safeParse(broken).success).toBe(false);
  });

  it("rejects an image with an unapproved licence", () => {
    const broken = structuredClone(raw);
    broken.prompts.find((prompt: { image: unknown }) => prompt.image).image.rights.license =
      "All rights reserved";
    expect(SeedSet.safeParse(broken).success).toBe(false);
  });
});
