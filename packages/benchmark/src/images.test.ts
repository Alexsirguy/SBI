import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { imagePath, loadSeedImage, sha256 } from "./images";
import type { SeedPrompt } from "./seed-set";

const bytes = new TextEncoder().encode("fake image");

function prompt(hash: string): SeedPrompt {
  return {
    id: "seed-test",
    category: "physics",
    taxonomyId: "object.test",
    label: "Test",
    aliases: [],
    question: "Why?",
    audience: "child",
    tags: [],
    expected: { recognition: "confident", safety: "allow" },
    image: {
      url: "https://upload.wikimedia.org/test.jpg",
      mime: "image/jpeg",
      sha256: hash,
      rights: {
        source: "Wikimedia Commons",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Test.jpg",
        title: "Test.jpg",
        author: "Someone",
        license: "CC0",
      },
    },
  };
}

const respond = () => vi.fn(async () => new Response(bytes));

describe("loadSeedImage", () => {
  it("downloads, verifies and caches the image", async () => {
    const dir = mkdtempSync(join(tmpdir(), "seed-"));
    const fetchImpl = respond();
    const seed = prompt(sha256(bytes));

    expect(await loadSeedImage(seed, dir, fetchImpl)).toEqual(bytes);
    expect(readFileSync(imagePath(seed, dir))).toEqual(Buffer.from(bytes));
    await loadSeedImage(seed, dir, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects bytes that do not match the pinned hash", async () => {
    const dir = mkdtempSync(join(tmpdir(), "seed-"));
    await expect(loadSeedImage(prompt("0".repeat(64)), dir, respond())).rejects.toThrow(
      "hash mismatch",
    );
  });
});
