import {
  Lesson,
  lessonContentHash,
  newId,
  type LessonDisclaimer,
  type LessonEditRequest,
} from "@sbi/contracts";
import { NOTICES_ES } from "./notices-es";

export class LessonEditError extends Error {}

const EDITED_NOTE =
  "Your teacher edited parts of this lesson. Those parts weren't re-checked against its sources.";

type Edits = Omit<LessonEditRequest, "lessonId">;

// The source is never changed; edited sections are named in a "teacher-edited" notice.
/** A teacher's edit as a new lesson document: their own copy, or its next version. */
export async function editLesson(
  source: Lesson,
  edits: Edits,
  { now = new Date(), id = newId, newCopy }: { now?: Date; id?: () => string; newCopy: boolean },
): Promise<{ lesson: Lesson; editedSectionIds: string[] }> {
  const edited = new Set<string>();
  let changed = false;

  const sections = source.sections.map((section) => {
    const change = edits.sections.find((item) => item.sectionId === section.sectionId);
    if (!change) return section;
    const heading = change.heading ?? section.heading;
    if (change.text === section.text && heading === section.heading) return section;
    edited.add(section.sectionId);
    changed = true;
    return { ...section, heading, text: change.text };
  });
  for (const change of edits.sections) {
    if (!source.sections.some((section) => section.sectionId === change.sectionId)) {
      throw new LessonEditError(`This lesson has no section ${change.sectionId}.`);
    }
  }

  const tasks = source.tasks.map((task) => {
    const change = edits.tasks.find((item) => item.taskId === task.taskId);
    if (!change) return task;
    const same =
      change.prompt === task.prompt &&
      change.answerIndex === task.answerIndex &&
      JSON.stringify(change.options) === JSON.stringify(task.options) &&
      JSON.stringify(change.feedback) === JSON.stringify(task.feedback);
    if (same) return task;
    changed = true;
    // A question has no section of its own, so the section it sits in is the one marked.
    for (const section of source.sections) {
      if (section.module === task.module) edited.add(section.sectionId);
    }
    return { ...task, ...change };
  });
  for (const change of edits.tasks) {
    if (!source.tasks.some((task) => task.taskId === change.taskId)) {
      throw new LessonEditError(`This lesson has no question ${change.taskId}.`);
    }
  }

  const title = edits.title ?? source.title;
  const summary = edits.summary ?? source.summary;
  if (title !== source.title || summary !== source.summary) changed = true;
  if (!changed) throw new LessonEditError("Nothing was changed.");

  const earlier = source.disclaimers?.find((item) => item.kind === "teacher-edited");
  const note: LessonDisclaimer = {
    kind: "teacher-edited",
    message: source.locale.startsWith("es") ? NOTICES_ES["teacher-edited"] : EDITED_NOTE,
    sectionIds: [...new Set([...(earlier?.sectionIds ?? []), ...edited])],
  };
  const at = now.toISOString();
  // Edited text was never reviewed, so a lesson can't keep an approval its new words didn't get.
  const approved = source.reviewStatus === "approved";
  let parsed: Lesson;
  try {
    parsed = Lesson.parse({
      ...source,
      disclaimers: [
        ...(source.disclaimers ?? []).filter((item) => item.kind !== "teacher-edited"),
        note,
      ],
      lessonId: newCopy ? id() : source.lessonId,
      version: newCopy ? 1 : source.version + 1,
      title,
      summary,
      sections,
      tasks,
      reviewStatus: approved ? "auto-validated" : source.reviewStatus,
      reviewedAt: approved ? undefined : source.reviewedAt,
      reviewedBy: approved ? undefined : source.reviewedBy,
      reuse: {
        ...source.reuse,
        cacheScope: "private",
        reuseCount: 0,
        invalidationReason: undefined,
        lastUserConfirmationAt: at,
      },
    });
  } catch {
    throw new LessonEditError(
      "Those changes don't make a complete lesson. Each question needs a right answer and one piece of feedback per option.",
    );
  }
  const lesson = {
    ...parsed,
    reuse: { ...parsed.reuse, contentHash: await lessonContentHash(parsed) },
  };
  return { editedSectionIds: [...edited], lesson };
}
