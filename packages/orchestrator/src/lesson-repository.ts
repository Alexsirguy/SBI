import type { Lesson } from "@sbi/contracts";

export interface LessonRepository {
  save(lesson: Lesson): Promise<void>;
  get(lessonId: string, version: number): Promise<Lesson | undefined>;
  latest(lessonId: string): Promise<Lesson | undefined>;
  findByIntent(intentSignature: string): Promise<Lesson[]>;
  /** Every stored version that shows any of these claims. */
  findByClaimIds(claimIds: string[]): Promise<Lesson[]>;
}

// Separate from LessonRepository so category fallback never forces itself on reuse-only callers.
export interface TaxonomyLessonLookup {
  /** Every stored version in one taxonomy category, newest first per lesson. */
  findByTaxonomy(taxonomyId: string): Promise<Lesson[]>;
}
