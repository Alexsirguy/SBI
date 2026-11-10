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
  // Merrill's First Principles (ADR 0017); the eight above remain for lessons drafted before it.
  "problem",
  "activate",
  "demonstrate",
  "apply",
  "integrate",
]);

export const REQUIRED_MODULES: readonly LessonModule[] = [
  "what-youre-seeing",
  "short-answer",
  "first-principles",
];

/** A Merrill lesson has every one of these, in this order, and no other module. */
export const MERRILL_MODULES: readonly LessonModule[] = [
  "problem",
  "activate",
  "demonstrate",
  "apply",
  "integrate",
];

/** The eight modules of lessons drafted before ADR 0017, in reader order (ADR 0011). */
export const LEGACY_MODULES: readonly LessonModule[] = LessonModule.options.filter(
  (module) => !MERRILL_MODULES.includes(module),
);

export function isMerrillLesson(lesson: { sections: { module: LessonModule }[] }): boolean {
  return lesson.sections.some((section) => MERRILL_MODULES.includes(section.module));
}

const Text = z.string().min(1);
const ParamId = z.string().regex(/^[a-z][A-Za-z0-9]{0,39}$/, "camelCase id");

/** A slider the learner moves in the lesson's experiment; the visual must offer one with this id. */
export const ExperimentControl = z
  .object({
    id: ParamId,
    label: Text.max(60),
    unit: z.string().max(20).default(""),
    min: z.number(),
    max: z.number(),
    value: z.number(),
  })
  .refine((control) => control.min < control.max && control.value >= control.min, {
    message: "min < max and value within range",
  })
  .refine((control) => control.value <= control.max, { message: "value within range" });

/** A number the experiment shows; the visual works it out from the controls. */
export const ExperimentReadout = z.object({
  id: ParamId,
  label: Text.max(60),
  unit: z.string().max(20).default(""),
});

/** What the learner can change and watch; Demonstrate steps and Apply goals name these ids. */
export const Experiment = z.object({
  controls: z.array(ExperimentControl).min(1).max(4),
  readouts: z.array(ExperimentReadout).min(1).max(3),
});

export const ControlSetting = z.object({ controlId: ParamId, value: z.number() });

/** Met when the named readout, worked out from the learner's sliders, satisfies op. */
export const ExperimentGoal = z.object({
  readoutId: ParamId,
  op: z.enum(["atLeast", "atMost", "near"]),
  value: z.number(),
  /** For near: how far off still counts, in the readout's unit. */
  tolerance: z.number().positive().optional(),
});

/** A guess (activate) or a challenge (apply): pick an answer, then each option says why. */
export const LessonTask = z
  .object({
    taskId: Id,
    module: z.enum(["activate", "apply"]),
    prompt: Text.max(400),
    options: z.array(Text.max(200)).min(2).max(4),
    answerIndex: z.int().nonnegative(),
    feedback: z.array(Text.max(400)).min(2).max(4),
    /** Where the sliders start for a challenge. */
    setup: z.array(ControlSetting).max(4).default([]),
    /** A challenge the learner solves in the experiment; without it, the options are the task. */
    goal: ExperimentGoal.optional(),
    claimIds: z.array(Uuid).default([]),
  })
  .refine((task) => task.answerIndex < task.options.length, {
    message: "answerIndex must name an option",
    path: ["answerIndex"],
  })
  .refine((task) => task.feedback.length === task.options.length, {
    message: "One feedback per option",
    path: ["feedback"],
  });

/** One step of a worked demonstration; settings move the experiment so the learner sees it. */
export const DemonstrationStep = z.object({
  text: Text.max(500),
  settings: z.array(ControlSetting).max(4).default([]),
});

/** One letter of a formula; a quantity the lab shows names its control or readout id. */
export const FormulaSymbol = z.object({
  symbol: Text.max(12),
  meaning: Text.max(80),
  unit: z.string().max(20).default(""),
  quantityId: ParamId.optional(),
});

/** A calculation the learner works out; right within tolerance, then shown the working. */
export const FormulaPractice = z.object({
  prompt: Text.max(400),
  answer: z.number(),
  unit: z.string().max(20).default(""),
  tolerance: z.number().positive(),
  working: z.array(Text.max(300)).min(1).max(6),
});

/** A formula the topic is taught with: its symbols, a worked example and one to try (#434). */
export const Formula = z.object({
  formulaId: Id,
  name: Text.max(80),
  expression: Text.max(80),
  /** The relation in words, e.g. "the rougher the surface, the bigger the friction". */
  words: Text.max(300),
  symbols: z.array(FormulaSymbol).min(2).max(6),
  example: z.object({
    problem: Text.max(400),
    steps: z.array(Text.max(300)).min(1).max(6),
    answer: Text.max(80),
  }),
  practice: FormulaPractice,
});

export const Concept = z.object({
  conceptId: Id,
  label: Text,
  prerequisites: z.array(Id).default([]),
});

export const LessonSection = z.object({
  sectionId: Id,
  module: LessonModule,
  // Optional so lessons drafted before headings existed still parse.
  heading: z.string().trim().min(1).max(120).optional(),
  text: Text,
  claimIds: z.array(Uuid).default([]),
  /** Demonstrate only: the worked solution, step by step. */
  steps: z.array(DemonstrationStep).max(8).optional(),
});

export const DisclaimerKind = z.enum([
  "safety",
  "awaiting-review",
  "unverified-sections",
  "sources-disagree",
  "open-questions",
  "limited-evidence",
  "reading-level",
  "model-knowledge",
  // Parts a teacher rewrote (#398); they keep their citations but weren't re-checked.
  "teacher-edited",
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
  /** Merrill lessons: the activate guess and the apply challenges. */
  tasks: z.array(LessonTask).default([]),
  experiment: Experiment.optional(),
  formulas: z.array(Formula).max(2).default([]),
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

  const merrill = isMerrillLesson(lesson);
  const required = merrill ? MERRILL_MODULES : REQUIRED_MODULES;
  for (const module of required.filter((wanted) => !modules.includes(wanted))) {
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

  if (merrill) issues.push(...merrillIssues(lesson, claims));
  issues.push(...formulaIssues(lesson));

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

function merrillIssues(
  lesson: z.output<typeof LessonShape>,
  claims: Map<string, unknown>,
): Issue[] {
  const issues: Issue[] = [];
  lesson.sections.forEach((section, index) => {
    if (!MERRILL_MODULES.includes(section.module)) {
      issues.push({
        message: `Module "${section.module}" does not belong in a Merrill lesson`,
        path: ["sections", index, "module"],
      });
    }
  });
  const order = lesson.sections.map((section) => section.module).join(",");
  if (order !== MERRILL_MODULES.join(",")) {
    issues.push({ message: `Modules must run ${MERRILL_MODULES.join(", ")}`, path: ["sections"] });
  }
  const guesses = lesson.tasks.filter((task) => task.module === "activate").length;
  const challenges = lesson.tasks.filter((task) => task.module === "apply").length;
  if (guesses !== 1) issues.push({ message: "Activate needs exactly one guess", path: ["tasks"] });
  if (challenges < 2 || challenges > 3) {
    issues.push({ message: "Apply needs two or three challenges", path: ["tasks"] });
  }
  const controls = new Set(lesson.experiment?.controls.map((control) => control.id) ?? []);
  const readouts = new Set(lesson.experiment?.readouts.map((readout) => readout.id) ?? []);
  const settings = (path: (string | number)[], list: { controlId: string }[]) => {
    for (const setting of list.filter((item) => !controls.has(item.controlId))) {
      issues.push({ message: `Unknown control "${setting.controlId}"`, path });
    }
  };
  lesson.tasks.forEach((task, index) => {
    settings(["tasks", index, "setup"], task.setup);
    if (task.goal && !readouts.has(task.goal.readoutId)) {
      issues.push({
        message: `Unknown readout "${task.goal.readoutId}"`,
        path: ["tasks", index, "goal"],
      });
    }
    for (const claimId of task.claimIds.filter((id) => !claims.has(id))) {
      issues.push({ message: `Unknown claim "${claimId}"`, path: ["tasks", index, "claimIds"] });
    }
  });
  lesson.sections.forEach((section, index) =>
    section.steps?.forEach((step, stepIndex) =>
      settings(["sections", index, "steps", stepIndex, "settings"], step.settings),
    ),
  );
  for (const id of duplicates(lesson.tasks.map((task) => task.taskId))) {
    issues.push({ message: `Duplicate id "${id}"`, path: ["tasks"] });
  }
  return issues;
}

function formulaIssues(lesson: z.output<typeof LessonShape>): Issue[] {
  const issues: Issue[] = [];
  const quantities = new Set([
    ...(lesson.experiment?.controls.map((control) => control.id) ?? []),
    ...(lesson.experiment?.readouts.map((readout) => readout.id) ?? []),
  ]);
  lesson.formulas.forEach((formula, index) => {
    formula.symbols.forEach((symbol, symbolIndex) => {
      if (symbol.quantityId && !quantities.has(symbol.quantityId)) {
        issues.push({
          message: `Unknown quantity "${symbol.quantityId}"`,
          path: ["formulas", index, "symbols", symbolIndex, "quantityId"],
        });
      }
    });
  });
  for (const id of duplicates(lesson.formulas.map((formula) => formula.formulaId))) {
    issues.push({ message: `Duplicate id "${id}"`, path: ["formulas"] });
  }
  return issues;
}

export const Lesson = LessonShape.superRefine((lesson, ctx) => {
  for (const issue of lessonIssues(lesson)) ctx.addIssue({ code: "custom", ...issue });
});

export type AudienceBand = z.infer<typeof AudienceBand>;
export type LessonModule = z.infer<typeof LessonModule>;
export type LessonSection = z.infer<typeof LessonSection>;
export type LessonTask = z.infer<typeof LessonTask>;
export type Experiment = z.infer<typeof Experiment>;
export type ExperimentGoal = z.infer<typeof ExperimentGoal>;
export type ControlSetting = z.infer<typeof ControlSetting>;
export type DemonstrationStep = z.infer<typeof DemonstrationStep>;
export type Formula = z.infer<typeof Formula>;
export type FormulaSymbol = z.infer<typeof FormulaSymbol>;
export type Lesson = z.infer<typeof Lesson>;
export type LessonDisclaimer = z.infer<typeof LessonDisclaimer>;
export type DisclaimerKind = z.infer<typeof DisclaimerKind>;
