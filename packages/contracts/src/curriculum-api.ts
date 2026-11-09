import { z } from "zod";
import { CurriculumId } from "./class-api";
import { Uuid } from "./common";

const Code = z.string().regex(/^[A-Za-z0-9.-]{2,60}$/);
const SubjectId = z.string().regex(/^(us|ng)(?:-[a-z]+)+$/);
const Level = z.string().trim().min(1).max(8);

export const CurriculumFramework = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source: z.url(),
  /** What the framework's terms ask us to show wherever its name or codes appear (ADR 0029). */
  notice: z.string().min(1),
});

export const CurriculumSubjectSummary = z.object({
  subjectId: SubjectId,
  frameworkId: z.string().min(1),
  name: z.string().min(1),
  levels: z.array(z.string().min(1)),
  topicCount: z.int().nonnegative(),
});

export const CurriculumSummary = z.object({
  curriculum: CurriculumId,
  label: z.string().min(1),
  levels: z.array(z.string().min(1)),
  frameworks: z.array(CurriculumFramework),
  subjects: z.array(CurriculumSubjectSummary),
});

export const CurriculaRequest = z.object({});
export const Curricula = z.object({ curricula: z.array(CurriculumSummary) });

/** A topic as we describe it: our own title and goals, with a link to the official text. */
export const CurriculumTopic = z.object({
  code: Code,
  curriculum: CurriculumId,
  subjectId: SubjectId,
  frameworkId: z.string().min(1),
  level: z.string().min(1),
  theme: z.string().nullable(),
  title: z.string().min(1),
  goals: z.array(z.string().min(1)),
  concepts: z.array(z.string().min(1)),
  sourceUrl: z.url().nullable(),
  /** Set once the topic has left the curriculum files; old links still resolve. */
  retiredAt: z.iso.datetime().nullable(),
});

export const CurriculumTopicsRequest = z.object({
  curriculum: CurriculumId,
  subject: SubjectId.optional(),
  level: Level.optional(),
});
export const CurriculumTopics = z.object({ topics: z.array(CurriculumTopic) });

export const CurriculumTopicRequest = z.object({ code: Code });
export const CurriculumTopicResult = z.object({ topic: CurriculumTopic });

export const TopicLinkKind = z.enum(["exact", "inferred"]);

export const LessonTopicsRequest = z.object({ lessonId: Uuid });
/** Topics a lesson is linked to: "exact" when made for the topic, "inferred" when matched. */
export const LessonTopics = z.object({
  links: z.array(z.object({ link: TopicLinkKind, topic: CurriculumTopic })),
});

export type CurriculumSummary = z.infer<typeof CurriculumSummary>;
export type CurriculumTopic = z.infer<typeof CurriculumTopic>;
