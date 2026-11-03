import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  API_ROUTES,
  LessonVisuals,
  SavedLessonRequest,
  SaveLessonRequest,
  type ApiResponse,
} from "@sbi/contracts";
import type { SavedLessonRepository, StoredAccount, StoredSavedLesson } from "@sbi/db";
import type { LessonRepository } from "@sbi/orchestrator";
import type { z } from "zod";
import { SameOriginGuard, SessionGuard, SignedInAccount } from "../account/account.guard";
import { UserFacingException } from "../common/user-facing.exception";
import { ZodPipe } from "../common/zod.pipe";
import { LESSON_EVIDENCE, LESSONS, SAVED_LESSONS } from "../tokens";
import type { EvidenceRepositories } from "@sbi/evidence";
import { lessonSources } from "./sources";

const NOT_SAVED = "That lesson is not in your saved lessons.";

function toSaved(saved: StoredSavedLesson): ApiResponse<"saveLesson"> {
  return {
    lessonId: saved.lessonId,
    savedAt: saved.savedAt.toISOString(),
    title: saved.title,
    version: saved.version,
  };
}

/** Saved lessons are private to their account; saving never keeps a photo (#103). */
@Controller()
@UseGuards(SameOriginGuard, SessionGuard)
export class SavedLessonsController {
  constructor(
    @Inject(SAVED_LESSONS) private readonly saved: SavedLessonRepository,
    @Inject(LESSONS) private readonly lessons: Pick<LessonRepository, "get">,
    @Inject(LESSON_EVIDENCE) private readonly evidence: Pick<EvidenceRepositories, "sources">,
  ) {}

  @Post(API_ROUTES.saveLesson.path)
  @HttpCode(200)
  async save(
    @SignedInAccount() account: StoredAccount,
    @Body(new ZodPipe(SaveLessonRequest, "Say which lesson to save."))
    { lessonId, version }: z.output<typeof SaveLessonRequest>,
  ): Promise<ApiResponse<"saveLesson">> {
    // The title comes from the stored lesson, never from the request.
    const lesson = await this.lessons.get(lessonId, version);
    if (!lesson) {
      throw new UserFacingException("That lesson could not be found.", HttpStatus.NOT_FOUND);
    }
    const saved = { lessonId, savedAt: new Date(), title: lesson.title.slice(0, 200), version };
    await this.saved.save(account.accountId, saved);
    return toSaved(saved);
  }

  @Get(API_ROUTES.savedLessons.path)
  async list(@SignedInAccount() account: StoredAccount): Promise<ApiResponse<"savedLessons">> {
    return { lessons: (await this.saved.list(account.accountId)).map(toSaved) };
  }

  @Get(API_ROUTES.openSavedLesson.path)
  async open(
    @SignedInAccount() account: StoredAccount,
    @Query(new ZodPipe(SavedLessonRequest, "Say which saved lesson to open."))
    { lessonId }: z.output<typeof SavedLessonRequest>,
  ): Promise<ApiResponse<"openSavedLesson">> {
    const saved = await this.saved.get(account.accountId, lessonId);
    // The pinned version, not the latest: what the learner saved is what they get back.
    const lesson = saved && (await this.lessons.get(lessonId, saved.version));
    if (!saved || !lesson) throw new UserFacingException(NOT_SAVED, HttpStatus.NOT_FOUND);
    const sourceIds = [...new Set(lesson.claims.flatMap((claim) => claim.sourceIds))];
    return {
      lesson,
      savedAt: saved.savedAt.toISOString(),
      sources: lessonSources(
        lesson,
        sourceIds.length > 0 ? await this.evidence.sources.getMany(sourceIds) : [],
      ),
      visuals: LessonVisuals.parse({ lessonId, visuals: lesson.visuals }),
    };
  }

  @Post(API_ROUTES.removeSavedLesson.path)
  @HttpCode(200)
  async remove(
    @SignedInAccount() account: StoredAccount,
    @Body(new ZodPipe(SavedLessonRequest, "Say which saved lesson to remove."))
    { lessonId }: z.output<typeof SavedLessonRequest>,
  ): Promise<ApiResponse<"removeSavedLesson">> {
    await this.saved.remove(account.accountId, lessonId);
    return { ok: true };
  }
}
