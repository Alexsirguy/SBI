import type { TeacherClass } from "@sbi/contracts";
import { CurriculumId } from "@sbi/contracts";
import type { StoredClass } from "@sbi/db";
import { controlsOf } from "./class-access";

const curriculumOf = (stored: StoredClass) => {
  const parsed = CurriculumId.safeParse(stored.curriculum);
  return parsed.success ? parsed.data : null;
};

export const lessonsOf = (stored: StoredClass) =>
  stored.lessons.map(({ lessonId, title, version }) => ({ lessonId, title, version }));

export function teacherView(stored: StoredClass): TeacherClass {
  return {
    archivedAt: stored.archivedAt?.toISOString() ?? null,
    classId: stored.classId,
    codeHint: stored.joinCodeHint,
    controls: controlsOf(stored),
    createdAt: stored.createdAt.toISOString(),
    curriculum: curriculumOf(stored),
    lessons: lessonsOf(stored),
    level: stored.level,
    name: stored.name,
  };
}

/** The learner's view: the class and its lessons, nothing about the teacher. */
export function learnerView(stored: StoredClass) {
  return {
    controls: controlsOf(stored),
    curriculum: curriculumOf(stored),
    lessons: lessonsOf(stored),
    level: stored.level,
    name: stored.name,
  };
}
