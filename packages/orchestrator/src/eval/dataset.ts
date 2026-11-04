import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AudienceBand } from "@sbi/contracts";
import { z } from "zod";

/** The fields of a seed prompt (docs/research/seed-set) this benchmark needs. */
export const SeedPrompt = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  taxonomyId: z.string().min(1).optional(),
  question: z.string().min(3),
  audience: AudienceBand,
  tags: z.array(z.string()).default([]),
  expected: z.object({ safety: z.enum(["allow", "redirect", "refuse"]) }),
});
export type SeedPrompt = z.infer<typeof SeedPrompt>;

export const Expectation = z.object({
  promptId: z.string().min(1),
  /** Facts a correct lesson states; each is judged against the lesson's own claims. */
  keyFacts: z.array(z.string().min(1)).min(1),
  /** Misconceptions the lesson must never assert. */
  mustNotAssert: z.array(z.string().min(1)).default([]),
  reference: z.url(),
});
export type Expectation = z.infer<typeof Expectation>;

export interface BenchmarkCase {
  prompt: SeedPrompt;
  expectation?: Expectation;
}

export interface BenchmarkSet {
  version: string;
  seedSet: string;
  cases: BenchmarkCase[];
}

/** Joins a seed set with the expected facts for it; prompts without expectations still run. */
export function loadBenchmarkSet(root: string, version = "v1"): BenchmarkSet {
  const file = z
    .object({
      version: z.string(),
      seedSet: z.string(),
      expectations: z.array(Expectation),
    })
    .parse(
      JSON.parse(readFileSync(join(root, "lesson-eval", version, "expectations.json"), "utf8")),
    );
  const prompts = z
    .object({ prompts: z.array(SeedPrompt) })
    .parse(
      JSON.parse(readFileSync(join(root, "seed-set", file.seedSet, "prompts.json"), "utf8")),
    ).prompts;
  const byId = new Map(file.expectations.map((item) => [item.promptId, item]));
  const unknown = file.expectations.filter((item) => !prompts.some((p) => p.id === item.promptId));
  if (unknown.length > 0) {
    throw new Error(
      `Expectations name unknown prompts: ${unknown.map((u) => u.promptId).join(", ")}`,
    );
  }
  return {
    version: file.version,
    seedSet: file.seedSet,
    cases: prompts.map((prompt) => ({ prompt, expectation: byId.get(prompt.id) })),
  };
}
