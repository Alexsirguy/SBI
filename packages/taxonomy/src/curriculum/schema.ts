import { CurriculumId } from "@sbi/contracts";
import { z } from "zod";

/** The curricula a learner or class can switch between; the id list lives in the contracts. */
export const Curriculum = CurriculumId;
export const CurriculumSubject = z.enum(["science", "maths", "physics", "chemistry", "biology"]);

const ConceptKey = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const Standard = z.strictObject({
  curriculum: Curriculum,
  /** The document the code comes from, e.g. "ngss" or "nerdc-sss". */
  framework: z.string().min(1),
  code: z.string().regex(/^[A-Za-z0-9.-]{2,60}$/),
  /** A grade band (US) or class (Nigeria), from the curriculum's own `levels`. */
  level: z.string().min(1),
  subject: CurriculumSubject,
  title: z.string().min(1),
  /** Concept keys (see `conceptKey`) a lesson must teach for this standard to apply. */
  concepts: z.array(ConceptKey).min(1),
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
export type CurriculumSubject = z.infer<typeof CurriculumSubject>;
export type Standard = z.infer<typeof Standard>;
export type CurriculumInfo = z.infer<typeof CurriculumInfo>;

/** The shared key for a concept label, so lesson concepts and standards meet on one spelling. */
export function conceptKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
