import { z } from "zod";
import { Id, IsoDateTime, Locale, SafetyClass, Sha256, Uuid } from "./common";
import { Claim } from "./evidence";
import { VisualRef } from "./visual";

export const AudienceBand = z.enum(["child", "teen", "adult", "general"]);
export const ReadingLevel = z.enum(["simple", "plain", "technical"]);
export const ReviewStatus = z.enum([
  "generated",
  "auto-validated",
  "needs-review",
  "approved",
  "rejected",
]);

export const LessonModule = z.enum([
  "what-youre-seeing",
  "short-answer",
  "first-principles",
  "how-parts-work",
  "try-an-idea",
  "history",
  "check-thinking",
  "go-further",
]);

export const REQUIRED_MODULES: readonly LessonModule[] = [
  "what-youre-seeing",
  "short-answer",
  "first-principles",
];

const Text = z.string().min(1);

export const Concept = z.object({
  conceptId: Id,
  label: Text,
  prerequisites: z.array(Id).default([]),
});

export const LessonSection = z.object({
  sectionId: Id,
  module: LessonModule,
  text: Text,
  claimIds: z.array(Uuid).default([]),
});

export const DisclaimerKind = z.enum([
  "safety",
  "awaiting-review",
  "unverified-sections",
  "sources-disagree",
  "open-questions",
  "limited-evidence",
  "reading-level",
]);

/** Shown with a lesson served before review, so learners know what was not fully checked. */
export const LessonDisclaimer = z.object({
  kind: DisclaimerKind,
  message: Text.max(300),
  /** Sections the notice applies to; empty for the whole lesson. */
  sectionIds: z.array(Id).default([]),
});

export const LessonReuse = z.object({
  intentSignature: Text,
  matchDimensions: z.array(Text).default([]),
  cacheScope: z.enum(["private", "shared"]),
  generatedAt: IsoDateTime,
  validatedAt: IsoDateTime.optional(),
  evidenceSnapshotId: Uuid,
  sourceFreshness: z.enum(["fresh", "stale", "unknown"]),
  modelVersion: Text,
  promptVersion: Text,
  policyVersion: Text,
  lastUserConfirmationAt: IsoDateTime.optional(),
  reuseCount: z.int().nonnegative().default(0),
  invalidationReason: Text.optional(),
  contentHash: Sha256,
});

const LessonShape = z.object({
  lessonId: Uuid,
  version: z.int().positive(),
  taxonomyId: Id,
  title: Text,
  locale: Locale,
  audience: z.array(AudienceBand).min(1),
  readingLevel: ReadingLevel,
  summary: Text,
  learningObjectives: z.array(Text).min(1),
  assumptions: z.array(Text).default([]),
  concepts: z.array(Concept).min(1),
  misconceptionNotes: z.array(Text).default([]),
  sections: z.array(LessonSection).min(1),
  claims: z.array(Claim).min(1),
  visuals: z.array(VisualRef).default([]),
  safetyClass: SafetyClass,
  reviewStatus: ReviewStatus,
  reviewedAt: IsoDateTime.optional(),
  reviewedBy: Text.optional(),
  reuse: LessonReuse,
  // Optional and outside the content hash: it reflects review state, not what is taught.
  disclaimers: z.array(LessonDisclaimer).optional(),
});

interface Issue {
  message: string;
  path: (string | number)[];
}

function duplicates(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

function lessonIssues(lesson: z.output<typeof LessonShape>): Issue[] {
  const issues: Issue[] = [];
  const claims = new Map(lesson.claims.map((claim) => [claim.claimId, claim]));
  const conceptIds = new Set(lesson.concepts.map((concept) => concept.conceptId));
  const modules = lesson.sections.map((section) => section.module);

  for (const module of REQUIRED_MODULES.filter((required) => !modules.includes(required))) {
    issues.push({ message: `Missing required module "${module}"`, path: ["sections"] });
  }
  for (const module of duplicates(modules)) {
    issues.push({ message: `Module "${module}" appears more than once`, path: ["sections"] });
  }
  for (const [field, ids] of [
    ["sections", lesson.sections.map((section) => section.sectionId)],
    ["claims", lesson.claims.map((claim) => claim.claimId)],
    ["concepts", lesson.concepts.map((concept) => concept.conceptId)],
  ] as const) {
    for (const id of duplicates(ids))
      issues.push({ message: `Duplicate id "${id}"`, path: [field] });
  }

  const sectionIds = new Set(lesson.sections.map((section) => section.sectionId));
  (lesson.disclaimers ?? []).forEach((disclaimer, index) => {
    for (const id of disclaimer.sectionIds.filter((sectionId) => !sectionIds.has(sectionId))) {
      issues.push({
        message: `Disclaimer names unknown section "${id}"`,
        path: ["disclaimers", index],
      });
    }
  });

  lesson.sections.forEach((section, index) => {
    const path = ["sections", index, "claimIds"];
    if (section.module === "history" && section.claimIds.length === 0) {
      issues.push({ message: "History must cite at least one claim", path });
    }
    for (const claimId of section.claimIds) {
      const claim = claims.get(claimId);
      if (!claim) issues.push({ message: `Unknown claim "${claimId}"`, path });
      else if (
        (claim.status === "unsupported" || claim.status === "disputed") &&
        !claim.uncertainty
      ) {
        issues.push({
          message: `Claim "${claimId}" is ${claim.status} and needs an uncertainty note`,
          path,
        });
      }
    }
  });

  lesson.claims.forEach((claim, index) => {
    for (const dependency of claim.dependsOn.filter((id) => !claims.has(id))) {
      issues.push({
        message: `Unknown claim dependency "${dependency}"`,
        path: ["claims", index, "dependsOn"],
      });
    }
  });

  lesson.concepts.forEach((concept, index) => {
    for (const prerequisite of concept.prerequisites) {
      if (prerequisite === concept.conceptId || !conceptIds.has(prerequisite)) {
        issues.push({
          message: `Invalid prerequisite "${prerequisite}"`,
          path: ["concepts", index, "prerequisites"],
        });
      }
    }
  });

  const decided = lesson.reviewStatus === "approved" || lesson.reviewStatus === "rejected";
  if (decided && (!lesson.reviewedAt || !lesson.reviewedBy)) {
    issues.push({
      message: `Lessons marked ${lesson.reviewStatus} need reviewedAt and reviewedBy`,
      path: ["reviewStatus"],
    });
  }

  return issues;
}

export const Lesson = LessonShape.superRefine((lesson, ctx) => {
  for (const issue of lessonIssues(lesson)) ctx.addIssue({ code: "custom", ...issue });
});

export type AudienceBand = z.infer<typeof AudienceBand>;
export type LessonModule = z.infer<typeof LessonModule>;
export type LessonSection = z.infer<typeof LessonSection>;
export type Lesson = z.infer<typeof Lesson>;
export type LessonDisclaimer = z.infer<typeof LessonDisclaimer>;
export type DisclaimerKind = z.infer<typeof DisclaimerKind>;
