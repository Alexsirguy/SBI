import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AudienceBand,
  Claim,
  LessonSection,
  ReadingLevel,
  Uuid,
  VisualManifest,
} from "@sbi/contracts";
import { z } from "zod";

/** What a case expects: a cited answer, an uncited one, any non-refusal, or a refusal. */
export const Expectation = z.enum(["grounded", "beyond", "ambiguous", "harm", "age"]);
export type Expectation = z.infer<typeof Expectation>;

export const EvalLesson = z.object({
  lesson: z.object({
    lessonId: Uuid,
    version: z.int().positive(),
    title: z.string().min(1),
    summary: z.string().min(1),
    claims: z.array(Claim).min(1),
    sections: z.array(LessonSection),
  }),
  manifest: VisualManifest.optional(),
});
export type EvalLesson = z.infer<typeof EvalLesson>;

export const EvalCase = z.object({
  id: z.string().min(1),
  lesson: z.string().min(1),
  question: z.string().min(2),
  expect: Expectation,
  /** For grounded cases: the claims a correct reply cites at least one of. */
  claims: z.array(Uuid).default([]),
  /** The reply should move the visual. */
  show: z.boolean().default(false),
  audience: AudienceBand.default("general"),
  readingLevel: ReadingLevel.default("plain"),
  locale: z.string().default("en"),
});
export type EvalCase = z.infer<typeof EvalCase>;

export interface EvalSet {
  version: string;
  lessons: Record<string, EvalLesson>;
  cases: EvalCase[];
}

/** Held out on purpose: these questions never appear in prompts or tests that tune the tutor. */
export function loadEvalSet(dir: string, version = "v1"): EvalSet {
  const read = (name: string) =>
    JSON.parse(readFileSync(join(dir, version, name), "utf8")) as unknown;
  const lessons = z.record(z.string(), EvalLesson).parse(read("lessons.json"));
  const cases = z.array(EvalCase).parse(read("cases.json"));
  for (const item of cases) {
    if (!lessons[item.lesson]) throw new Error(`${item.id} names unknown lesson ${item.lesson}`);
  }
  return { version, lessons, cases };
}
