import { Controller, Get, HttpStatus, Inject, Ip, Query } from "@nestjs/common";
import {
  API_ROUTES,
  LessonVisuals,
  OpenClassLessonRequest,
  OpenClassRequest,
  type ApiResponse,
} from "@sbi/contracts";
import type { EvidenceRepositories } from "@sbi/evidence";
import type { LessonRepository } from "@sbi/orchestrator";
import type { z } from "zod";
import type { RateLimiter } from "../common/rate-limiter";
import { UserFacingException } from "../common/user-facing.exception";
import { ZodPipe } from "../common/zod.pipe";
import { lessonSources } from "../lesson/sources";
import { CLASS_OPEN_LIMITER, LESSON_EVIDENCE, LESSONS } from "../tokens";
import { CLASS_GONE, ClassAccess } from "./class-access";
import { learnerView } from "./class-view";

const BAD_CODE = "Type the class code your teacher gave you.";

/** What a pupil opens from a class link: no sign-in, and nothing about them is kept (ADR 0027). */
@Controller()
export class ClassLinkController {
  constructor(
    @Inject(ClassAccess) private readonly access: ClassAccess,
    @Inject(LESSONS) private readonly lessons: Pick<LessonRepository, "get">,
    @Inject(LESSON_EVIDENCE) private readonly evidence: Pick<EvidenceRepositories, "sources">,
    @Inject(CLASS_OPEN_LIMITER) private readonly limiter: RateLimiter,
  ) {}

  // Per client: slows anyone guessing codes, while a class sharing one school address still fits.
  private async find(code: string, ip: string) {
    if (!this.limiter.allow(ip)) {
      throw new UserFacingException(
        "Too many tries. Wait a minute and try again.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const found = await this.access.find(code);
    if (!found) throw new UserFacingException(CLASS_GONE, HttpStatus.NOT_FOUND);
    return found;
  }

  @Get(API_ROUTES.openClass.path)
  async open(
    @Query(new ZodPipe(OpenClassRequest, BAD_CODE)) { code }: z.output<typeof OpenClassRequest>,
    @Ip() ip: string,
  ): Promise<ApiResponse<"openClass">> {
    return learnerView(await this.find(code, ip));
  }

  @Get(API_ROUTES.openClassLesson.path)
  async openLesson(
    @Query(new ZodPipe(OpenClassLessonRequest, BAD_CODE))
    { code, lessonId }: z.output<typeof OpenClassLessonRequest>,
    @Ip() ip: string,
  ): Promise<ApiResponse<"openClassLesson">> {
    const found = await this.find(code, ip);
    const entry = found.lessons.find((lesson) => lesson.lessonId === lessonId);
    const stored = entry && (await this.lessons.get(lessonId, entry.version));
    if (!stored) {
      throw new UserFacingException(
        "That lesson isn't in this class any more.",
        HttpStatus.NOT_FOUND,
      );
    }
    // Assumptions are the asker's own words, so they never travel to a class (as with sharing).
    const lesson = { ...stored, assumptions: [] };
    const sourceIds = [...new Set(lesson.claims.flatMap((claim) => claim.sourceIds))];
    return {
      lesson,
      sources: lessonSources(
        lesson,
        sourceIds.length > 0 ? await this.evidence.sources.getMany(sourceIds) : [],
      ),
      visuals: LessonVisuals.parse({ lessonId, visuals: lesson.visuals }),
    };
  }
}
