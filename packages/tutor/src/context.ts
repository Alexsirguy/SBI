import type { AudienceBand, Claim, Lesson, TutorTurn } from "@sbi/contracts";

/** How many earlier exchanges the model sees; older ones cost tokens without helping a reply. */
export const HISTORY_TURNS = 4;

export interface TutorQuestion {
  sessionId: string;
  lessonId: string;
  lessonVersion: number;
  text: string;
  audience: AudienceBand;
  readingLevel: Lesson["readingLevel"];
  locale: string;
}

export interface TutorContext {
  lessonId: string;
  lessonVersion: number;
  title: string;
  summary: string;
  claims: Claim[];
  audience: AudienceBand;
  readingLevel: Lesson["readingLevel"];
  locale: string;
  history: { userText: string; text: string; clarifying: boolean }[];
}

/** Everything the model may draw on: this lesson and this conversation, nothing else. */
export function policyContext(
  lesson: Pick<Lesson, "lessonId" | "version" | "title" | "summary" | "claims">,
  question: Pick<TutorQuestion, "audience" | "readingLevel" | "locale">,
  history: readonly TutorTurn[],
): TutorContext {
  const sameLesson = history.filter(
    (turn) => turn.lessonId === lesson.lessonId && turn.lessonVersion === lesson.version,
  );
  return {
    lessonId: lesson.lessonId,
    lessonVersion: lesson.version,
    title: lesson.title,
    summary: lesson.summary,
    claims: lesson.claims,
    audience: question.audience,
    readingLevel: question.readingLevel,
    locale: question.locale,
    history: sameLesson.slice(-HISTORY_TURNS).map((turn) => ({
      userText: turn.userText,
      text: turn.response.text,
      clarifying: turn.response.kind === "clarifying",
    })),
  };
}
