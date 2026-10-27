import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AudienceBand, Id, IsoDate, Sha256 } from "@sbi/contracts";
import { z } from "zod";

export const SEED_SET_PATH = join(
  import.meta.dirname,
  "../../../docs/research/seed-set/v1/prompts.json",
);

export const SteamCategory = z.enum(["maths", "physics", "biology", "chemistry", "arts"]);

export const SeedTag = z.enum([
  "ambiguous-photo",
  "unsupported",
  "misconception",
  "high-risk",
  "paraphrase",
  "text-only",
]);

// Images are fetched for evaluation only, never redistributed, so share-alike and GFDL are acceptable.
export const SeedLicense = z
  .string()
  .regex(/^(CC0|Public domain|CC BY(-SA)? \d\.\d( [a-z]{2})?|GFDL \d\.\d|FAL)$/);

export const ImageRights = z.object({
  source: z.literal("Wikimedia Commons"),
  sourceUrl: z.url(),
  title: z.string().min(1),
  author: z.string().min(1),
  license: SeedLicense,
  licenseUrl: z.url().optional(),
});

export const SeedImage = z.object({
  url: z.url(),
  mime: z.enum(["image/jpeg", "image/png"]),
  sha256: Sha256,
  rights: ImageRights,
});

export const SeedPrompt = z.object({
  id: Id,
  category: SteamCategory,
  taxonomyId: Id,
  label: z.string().min(1),
  aliases: z.array(z.string().min(1)),
  question: z.string().min(1),
  audience: AudienceBand,
  tags: z.array(SeedTag),
  paraphraseOf: Id.optional(),
  misconception: z.string().min(1).optional(),
  expected: z.object({
    recognition: z.enum(["confident", "ambiguous", "unsupported", "not-applicable"]),
    safety: z.enum(["allow", "redirect", "refuse"]),
  }),
  image: SeedImage.nullable(),
});

interface Issue {
  message: string;
  path: (string | number)[];
}

function promptIssues(prompts: z.output<typeof SeedPrompt>[]): Issue[] {
  const byId = new Map(prompts.map((prompt) => [prompt.id, prompt]));
  const issues: Issue[] = [];
  if (byId.size !== prompts.length) issues.push({ message: "Duplicate prompt id", path: [] });

  prompts.forEach((prompt, index) => {
    const at = (message: string) =>
      issues.push({ message: `${prompt.id}: ${message}`, path: [index] });
    const has = (tag: z.infer<typeof SeedTag>) => prompt.tags.includes(tag);
    if (has("text-only") !== (prompt.image === null))
      at("text-only tag must match a missing image");
    if (has("misconception") !== Boolean(prompt.misconception)) at("misconception tag needs text");
    if ((prompt.expected.recognition === "not-applicable") !== (prompt.image === null)) {
      at("recognition is not-applicable exactly when there is no image");
    }
    if (has("paraphrase") !== Boolean(prompt.paraphraseOf)) at("paraphrase tag needs paraphraseOf");
    if (prompt.paraphraseOf) {
      const original = byId.get(prompt.paraphraseOf);
      if (!original || original.id === prompt.id) at(`unknown paraphraseOf ${prompt.paraphraseOf}`);
      else if (original.taxonomyId !== prompt.taxonomyId)
        at("paraphrase must share the taxonomyId");
    }
  });
  return issues;
}

export const SeedSet = z
  .object({
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    createdAt: IsoDate,
    prompts: z.array(SeedPrompt).min(1),
  })
  .superRefine((set, ctx) => {
    for (const issue of promptIssues(set.prompts)) {
      ctx.addIssue({ code: "custom", message: issue.message, path: ["prompts", ...issue.path] });
    }
  });

/** Reads and validates the versioned seed set. */
export function loadSeedSet(path: string = SEED_SET_PATH): SeedSet {
  return SeedSet.parse(JSON.parse(readFileSync(path, "utf8")));
}

export type SteamCategory = z.infer<typeof SteamCategory>;
export type SeedTag = z.infer<typeof SeedTag>;
export type SeedImage = z.infer<typeof SeedImage>;
export type SeedPrompt = z.infer<typeof SeedPrompt>;
export type SeedSet = z.infer<typeof SeedSet>;
