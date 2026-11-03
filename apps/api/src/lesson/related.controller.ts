import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Ip,
  Post,
  Query,
} from "@nestjs/common";
import type { EventSink } from "@sbi/analytics";
import {
  API_ROUTES,
  NextConceptEventRequest,
  RelatedLessonsRequest,
  type ApiResponse,
} from "@sbi/contracts";
import { relatedConcepts, type LessonRepository } from "@sbi/orchestrator";
import type { Taxonomy } from "@sbi/taxonomy";
import type { z } from "zod";
import type { RateLimiter } from "../common/rate-limiter";
import { UserFacingException } from "../common/user-facing.exception";
import { ZodPipe } from "../common/zod.pipe";
import { EVENT_SINK, EVENTS_LIMITER, LESSONS, TAXONOMY } from "../tokens";

@Controller()
export class RelatedController {
  constructor(
    @Inject(LESSONS) private readonly lessons: Pick<LessonRepository, "get">,
    @Inject(TAXONOMY) private readonly taxonomy: Pick<Taxonomy, "entries" | "concepts">,
    @Inject(EVENT_SINK) private readonly events: EventSink,
    @Inject(EVENTS_LIMITER) private readonly limiter: RateLimiter,
  ) {}

  @Get(API_ROUTES.relatedLessons.path)
  async related(
    @Query(new ZodPipe(RelatedLessonsRequest, "Name a lesson and its version."))
    { lessonId, version }: z.output<typeof RelatedLessonsRequest>,
  ): Promise<ApiResponse<"relatedLessons">> {
    const lesson = await this.lessons.get(lessonId, Number(version));
    if (!lesson)
      throw new UserFacingException("That lesson is not available.", HttpStatus.NOT_FOUND);
    // Inherited concepts count, so a kettle relates through its category's ideas too.
    const nodes = this.taxonomy.entries().map((entry) => ({
      concepts: this.taxonomy.concepts(entry.id),
      id: entry.id,
      kind: entry.kind,
      label: entry.label,
      parentId: entry.parentId,
    }));
    return {
      related: relatedConcepts(nodes, {
        concepts: lesson.concepts.map((concept) => concept.label),
        taxonomyId: lesson.taxonomyId,
      }),
    };
  }

  @Post(API_ROUTES.recordNextConcept.path)
  @HttpCode(200)
  record(
    @Body(new ZodPipe(NextConceptEventRequest, "Name the lesson, the suggestion and its place."))
    event: z.output<typeof NextConceptEventRequest>,
    @Ip() ip: string,
  ): ApiResponse<"recordNextConcept"> {
    if (!this.limiter.allow(ip)) {
      throw new UserFacingException("Too many events.", HttpStatus.TOO_MANY_REQUESTS);
    }
    this.events({ ...event, at: new Date().toISOString(), type: "next-concept" });
    return { ok: true };
  }
}
