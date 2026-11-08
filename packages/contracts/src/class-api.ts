import { z } from "zod";
import { IsoDateTime, Uuid } from "./common";
import { AudienceBand, Lesson } from "./lesson";
import { LessonSources, LessonVisuals } from "./lesson-api";
import { SafetyCategory } from "./safety";

/** The curricula a class or learner can choose (#114). */
export const CurriculumId = z.enum(["us", "ng"]);
export type CurriculumId = z.infer<typeof CurriculumId>;

export const CLASS_NAME_MAX = 60;
export const CLASS_LESSONS_MAX = 50;

// Crockford base32: no I, L, O or U, so a code read aloud or copied by hand can't be mistyped.
const JOIN_ALPHABET = /^[0-9A-HJKMNP-TV-Z]{8}$/;

/** Upper-cases a typed code, drops spaces and dashes, and maps look-alike letters to digits. */
export function normaliseJoinCode(code: string): string {
  return code
    .toUpperCase()
    .replace(/[\s-]+/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

/** A class join code, as typed or pasted; always parsed to its 8-character canonical form. */
export const JoinCode = z
  .string()
  .max(20)
  .transform(normaliseJoinCode)
  .pipe(z.string().regex(JOIN_ALPHABET, "That class code isn't right."));

export const ClassControls = z.object({
  /** Overrides the learner's own age band for every lesson asked from the class. */
  audienceLock: AudienceBand.nullable(),
  /** Lessons in these risk categories are held for the class with the usual safety message. */
  blockedCategories: z.array(SafetyCategory).max(SafetyCategory.options.length),
  tutorEnabled: z.boolean(),
});
export type ClassControls = z.infer<typeof ClassControls>;

export const DEFAULT_CLASS_CONTROLS: ClassControls = {
  audienceLock: null,
  blockedCategories: [],
  tutorEnabled: true,
};

const ClassName = z.string().trim().min(1).max(CLASS_NAME_MAX);
const Level = z.string().trim().min(1).max(8);

export const ClassLesson = z.object({
  lessonId: Uuid,
  version: z.number().int().positive(),
  title: z.string().min(1),
});

export const TeacherClass = z.object({
  classId: Uuid,
  name: z.string().min(1),
  /** The code's last two characters, so a teacher can tell codes apart without it being stored. */
  codeHint: z.string(),
  /** The full code, for sharing again; null for a class made before codes were kept. */
  joinCode: z.string().nullable(),
  curriculum: CurriculumId.nullable(),
  level: z.string().nullable(),
  controls: ClassControls,
  lessons: z.array(ClassLesson),
  createdAt: IsoDateTime,
  archivedAt: IsoDateTime.nullable(),
});
export type TeacherClass = z.infer<typeof TeacherClass>;

export const TeacherClasses = z.object({
  /** False until the account turns on teaching tools. */
  educator: z.boolean(),
  classes: z.array(TeacherClass),
});

export const EducatorStatus = z.object({ educator: z.literal(true) });

export const CreateClassRequest = z.object({
  name: ClassName,
  curriculum: CurriculumId.nullable().default(null),
  level: Level.nullable().default(null),
});

/** The only time the full join code is returned; only its hash is kept. */
export const ClassWithCode = z.object({ class: TeacherClass, joinCode: z.string() });

export const UpdateClassRequest = z.object({
  classId: Uuid,
  name: ClassName.optional(),
  curriculum: CurriculumId.nullable().optional(),
  level: Level.nullable().optional(),
  controls: ClassControls.optional(),
});

export const ClassIdRequest = z.object({ classId: Uuid });
export const ArchiveClassRequest = z.object({ classId: Uuid, archived: z.boolean() });
export const ClassLessonRequest = z.object({ classId: Uuid, lessonId: Uuid });
export const UpdatedClass = z.object({ class: TeacherClass });

export const OpenClassRequest = z.object({ code: JoinCode });

/** What a learner sees on a class link: nothing about the teacher or other learners. */
export const OpenedClass = z.object({
  name: z.string().min(1),
  curriculum: CurriculumId.nullable(),
  level: z.string().nullable(),
  controls: ClassControls,
  lessons: z.array(ClassLesson),
});

export const OpenClassLessonRequest = z.object({ code: JoinCode, lessonId: Uuid });
export const OpenedClassLesson = z.object({
  lesson: Lesson,
  sources: LessonSources,
  visuals: LessonVisuals,
});

/** What a pupil's page may count for the class; lesson opens are counted by the API itself. */
export const ClassActivityMetric = z.enum(["check_answered", "check_correct", "visual_used"]);

export const RecordClassActivityRequest = z.object({
  code: JoinCode,
  metric: ClassActivityMetric,
});

const Cell = z.number().int().min(0).nullable();
const MetricCells = z.object({
  lesson_opened: Cell,
  check_answered: Cell,
  check_correct: Cell,
  visual_used: Cell,
});

/** Weekly counts for the whole class, hidden below `minCount`; there is no per-pupil view. */
export const ClassSummary = z.object({
  minCount: z.number().int().positive(),
  totals: MetricCells,
  weeks: z.array(z.object({ week: z.string().regex(/^\d{4}-W\d{2}$/), counts: MetricCells })),
});
export type ClassSummary = z.infer<typeof ClassSummary>;

export const ClassSummaryRequest = z.object({ classId: Uuid });
