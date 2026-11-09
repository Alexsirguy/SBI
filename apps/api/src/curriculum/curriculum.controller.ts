import { Controller, Get, HttpStatus, Inject, Query } from "@nestjs/common";
import {
  API_ROUTES,
  CurriculumId,
  CurriculumTopicRequest,
  CurriculumTopicsRequest,
  LessonTopicsRequest,
  type ApiResponse,
  type CurriculumTopic,
} from "@sbi/contracts";
import type { CurriculumRepository, StoredTopic } from "@sbi/db";
import { curriculumSource } from "@sbi/rights";
import type { z } from "zod";
import { UserFacingException } from "../common/user-facing.exception";
import { ZodPipe } from "../common/zod.pipe";
import { CURRICULUM } from "../tokens";

export const toTopic = (stored: StoredTopic): CurriculumTopic => ({
  code: stored.topicCode,
  concepts: stored.concepts,
  curriculum: CurriculumId.parse(stored.curriculumId),
  frameworkId: stored.frameworkId,
  goals: stored.goals,
  level: stored.level,
  retiredAt: stored.retiredAt?.toISOString() ?? null,
  sourceUrl: stored.sourceUrl,
  subjectId: stored.subjectId,
  theme: stored.theme,
  title: stored.title,
});

/** The curriculum catalogue, read from the tables the migrate step fills (ADR 0029). */
@Controller()
export class CurriculumController {
  constructor(@Inject(CURRICULUM) private readonly curriculum: CurriculumRepository) {}

  @Get(API_ROUTES.curricula.path)
  async curricula(): Promise<ApiResponse<"curricula">> {
    const stored = await this.curriculum.curricula();
    return {
      curricula: stored
        .filter((item) => CurriculumId.safeParse(item.curriculumId).success)
        .map((item) => ({
          curriculum: CurriculumId.parse(item.curriculumId),
          // A framework without a rights record has no notice to show, so it is left out.
          frameworks: item.frameworks.flatMap((framework) => {
            const source = curriculumSource(framework.id);
            return source ? [{ ...framework, notice: source.notice }] : [];
          }),
          label: item.label,
          levels: item.levels,
          subjects: item.subjects.map(({ subjectId, frameworkId, name, levels, topicCount }) => ({
            frameworkId,
            levels,
            name,
            subjectId,
            topicCount,
          })),
        })),
    };
  }

  @Get(API_ROUTES.curriculumTopics.path)
  async topics(
    @Query(new ZodPipe(CurriculumTopicsRequest, "Name a curriculum: us or ng."))
    { curriculum, subject, level }: z.output<typeof CurriculumTopicsRequest>,
  ): Promise<ApiResponse<"curriculumTopics">> {
    const stored = await this.curriculum.topics({
      curriculumId: curriculum,
      level,
      subjectId: subject,
    });
    return { topics: stored.map(toTopic) };
  }

  @Get(API_ROUTES.lessonTopics.path)
  async lessonTopics(
    @Query(new ZodPipe(LessonTopicsRequest, "Give a lesson id."))
    { lessonId }: z.output<typeof LessonTopicsRequest>,
  ): Promise<ApiResponse<"lessonTopics">> {
    const links = await this.curriculum.lessonTopics(lessonId);
    const found = await Promise.all(
      links.map(async ({ topicCode, link }) => {
        const topic = await this.curriculum.topic(topicCode);
        return topic ? [{ link, topic: toTopic(topic) }] : [];
      }),
    );
    // Only links, never who asked: a lesson id says nothing about a learner.
    return {
      links: found.flat().sort((a, b) => Number(a.link !== "exact") - Number(b.link !== "exact")),
    };
  }

  @Get(API_ROUTES.curriculumTopic.path)
  async topic(
    @Query(new ZodPipe(CurriculumTopicRequest, "Give a topic code, such as MS-PS1-4."))
    { code }: z.output<typeof CurriculumTopicRequest>,
  ): Promise<ApiResponse<"curriculumTopic">> {
    const stored = await this.curriculum.topic(code);
    if (!stored) {
      throw new UserFacingException("That topic could not be found.", HttpStatus.NOT_FOUND);
    }
    return { topic: toTopic(stored) };
  }
}
