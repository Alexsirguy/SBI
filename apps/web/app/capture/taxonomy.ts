import type { RecognitionCandidate } from "@sbi/contracts";
import type { z } from "zod";

// Text search and recognition offer the learner the same choice: an object and its label.
export type CandidateChoice = Pick<z.output<typeof RecognitionCandidate>, "taxonomyId" | "label">;

export interface SeedEntry extends CandidateChoice {
  keywords: string[];
}

// TODO(#36): replace this seed with the taxonomy service's alias search.
const SEED: SeedEntry[] = [
  { keywords: ["boil", "tea", "water"], label: "Kettle", taxonomyId: "household.kitchen.kettle" },
  { keywords: ["brew", "coffee"], label: "Coffee pot", taxonomyId: "household.kitchen.coffee-pot" },
  { keywords: ["brew", "pot", "tea"], label: "Teapot", taxonomyId: "household.kitchen.teapot" },
  { keywords: ["bread", "toast"], label: "Toaster", taxonomyId: "household.kitchen.toaster" },
  { keywords: ["bike", "cycle", "wheel"], label: "Bicycle", taxonomyId: "transport.bicycle" },
  {
    keywords: ["bulb", "lamp", "light"],
    label: "Light bulb",
    taxonomyId: "household.lighting.bulb",
  },
  { keywords: ["reflection"], label: "Mirror", taxonomyId: "household.mirror" },
  { keywords: ["fridge", "magnetic"], label: "Magnet", taxonomyId: "household.magnet" },
  { keywords: ["rain"], label: "Umbrella", taxonomyId: "personal.umbrella" },
  {
    keywords: ["glasses", "lens", "spectacles"],
    label: "Eyeglasses",
    taxonomyId: "personal.eyeglasses",
  },
];

export const MAX_CANDIDATES = 5;
export const MIN_QUERY_LENGTH = 2;

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

// "kettles" and "glasses" should still find "kettle" and "glass".
function variants(token: string): string[] {
  const forms = [token];
  if (token.length > 3 && token.endsWith("s")) {
    forms.push(token.slice(0, -1));
  }
  if (token.length > 4 && token.endsWith("es")) {
    forms.push(token.slice(0, -2));
  }
  return forms;
}

// Label matches outrank keyword matches so the object named is offered first.
function scoreToken(token: string, entry: SeedEntry): number {
  const labelWords = words(entry.label);
  const keywords = entry.keywords.flatMap(words);
  let best = 0;
  for (const form of variants(token)) {
    if (labelWords.includes(form)) best = Math.max(best, 4);
    else if (labelWords.some((word) => word.startsWith(form))) best = Math.max(best, 3);
    else if (keywords.includes(form)) best = Math.max(best, 2);
    else if (
      keywords.some((word) => word.startsWith(form)) ||
      entry.label.toLowerCase().includes(form)
    ) {
      best = Math.max(best, 1);
    }
  }
  return best;
}

export function searchTaxonomy(query: string, seed: SeedEntry[] = SEED): CandidateChoice[] {
  const tokens = words(query);
  if (tokens.join("").length < MIN_QUERY_LENGTH) {
    return [];
  }
  return seed
    .map((entry) => {
      const scores = tokens.map((token) => scoreToken(token, entry));
      return {
        entry,
        score: scores.every((score) => score > 0) ? scores.reduce((a, b) => a + b) : 0,
      };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.entry.label.localeCompare(right.entry.label),
    )
    .slice(0, MAX_CANDIDATES)
    .map(({ entry }) => ({ label: entry.label, taxonomyId: entry.taxonomyId }));
}
