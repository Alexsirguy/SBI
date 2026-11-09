import { CurriculumId } from "@sbi/contracts";
import { z } from "zod";

/** The curricula a learner or class can switch between; the id list lives in the contracts. */
export const Curriculum = CurriculumId;
/** A subject as a curriculum names it, e.g. "ng-physics" or "us-life-science" (ADR 0029). */
export const SubjectId = z.string().regex(/^(us|ng)(?:-[a-z]+)+$/);

const ConceptKey = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const Standard = z.strictObject({
  curriculum: Curriculum,
  /** The document the code comes from, e.g. "ngss" or "nerdc-sss". */
  framework: z.string().min(1),
  code: z.string().regex(/^[A-Za-z0-9.-]{2,60}$/),
  /** A grade band (US) or class (Nigeria), from the curriculum's own `levels`. */
  level: z.string().min(1),
  subject: SubjectId,
  /** The strand or theme the topic sits in, as the curriculum groups it. */
  theme: z.string().min(1).optional(),
  /** Our own short title; never the standard's official text (ADR 0029). */
  title: z.string().min(1),
  /** What a pupil should be able to do, in our own words. */
  goals: z.array(z.string().min(1)).default([]),
  /** The official text, for readers who want the standard itself. */
  sourceUrl: z.url().optional(),
  /** Concept keys (see `conceptKey`) a lesson must teach for this standard to apply. */
  concepts: z.array(ConceptKey).min(1),
});

export const SubjectInfo = z.strictObject({
  id: SubjectId,
  curriculum: Curriculum,
  framework: z.string().min(1),
  name: z.string().min(1),
  /** The curriculum levels this subject is taught at, in order. */
  levels: z.array(z.string().min(1)).min(1),
});

export const CurriculumInfo = z.strictObject({
  id: Curriculum,
  label: z.string().min(1),
  levels: z.array(z.string().min(1)).min(1),
  frameworks: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        name: z.string().min(1),
        source: z.string().min(1),
      }),
    )
    .min(1),
});

export type Curriculum = z.infer<typeof Curriculum>;
export type SubjectId = z.infer<typeof SubjectId>;
export type SubjectInfo = z.infer<typeof SubjectInfo>;
export type Standard = z.input<typeof Standard>;
export type CurriculumInfo = z.infer<typeof CurriculumInfo>;

/** The shared key for a concept label, so lesson concepts and standards meet on one spelling. */
export function conceptKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
