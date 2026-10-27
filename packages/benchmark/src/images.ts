import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SeedPrompt, SeedSet } from "./seed-set";

export const IMAGE_CACHE_DIR = join(import.meta.dirname, "../.cache/seed-images");

// Wikimedia rejects requests without a descriptive User-Agent.
const USER_AGENT = "SBI-benchmark/1.0 (research prototype)";

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function imagePath(prompt: SeedPrompt, dir: string = IMAGE_CACHE_DIR): string {
  return join(dir, prompt.image?.mime === "image/png" ? `${prompt.id}.png` : `${prompt.id}.jpg`);
}

/** Returns cached image bytes, downloading and verifying the pinned hash when missing. */
export async function loadSeedImage(
  prompt: SeedPrompt,
  dir: string = IMAGE_CACHE_DIR,
  fetchImpl: typeof fetch = fetch,
): Promise<Uint8Array> {
  const image = prompt.image;
  if (!image) throw new Error(`${prompt.id} has no image`);
  const path = imagePath(prompt, dir);
  if (existsSync(path)) {
    const cached = new Uint8Array(readFileSync(path));
    if (sha256(cached) === image.sha256) return cached;
  }
  const response = await fetchImpl(image.url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${prompt.id}: download failed with ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (sha256(bytes) !== image.sha256) throw new Error(`${prompt.id}: image hash mismatch`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, bytes);
  return bytes;
}

export async function fetchSeedImages(
  set: SeedSet,
  dir: string = IMAGE_CACHE_DIR,
): Promise<number> {
  let count = 0;
  for (const prompt of set.prompts.filter((candidate) => candidate.image)) {
    await loadSeedImage(prompt, dir);
    count += 1;
  }
  return count;
}
