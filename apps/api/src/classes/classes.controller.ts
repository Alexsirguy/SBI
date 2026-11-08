import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  API_ROUTES,
  ArchiveClassRequest,
  CLASS_LESSONS_MAX,
  ClassIdRequest,
  ClassLessonRequest,
  CreateClassRequest,
  DEFAULT_CLASS_CONTROLS,
  newId,
  UpdateClassRequest,
  type ApiResponse,
} from "@sbi/contracts";
import type { ClassRepository, SavedLessonRepository, StoredAccount, StoredClass } from "@sbi/db";
import { CURRICULA, type Curriculum } from "@sbi/taxonomy";
import type { z } from "zod";
import { SameOriginGuard, SessionGuard, SignedInAccount } from "../account/account.guard";
import { UserFacingException } from "../common/user-facing.exception";
import { ZodPipe } from "../common/zod.pipe";
import { CLASSES, SAVED_LESSONS } from "../tokens";
import { teacherView } from "./class-view";
import { codeHint, hashJoinCode, newJoinCode } from "./join-code";

/** Enough for a teacher's timetable; stops one account minting codes without end. */
export const MAX_OPEN_CLASSES = 30;
const NOT_FOUND = "That class could not be found.";

const isDuplicate = (error: unknown) =>
  (error as { code?: string })?.code === "ER_DUP_ENTRY" ||
  /duplicate/i.test((error as Error)?.message ?? "");

function checkLevel(curriculum: Curriculum | null, level: string | null) {
  if (level === null) return;
  if (curriculum === null || !CURRICULA[curriculum].levels.includes(level)) {
    throw new UserFacingException(
      "Pick a level from the class's curriculum.",
      HttpStatus.BAD_REQUEST,
    );
  }
}

/** Teachers' class routes; pupils never sign in, so nothing here is about them (ADR 0027). */
@Controller()
@UseGuards(SameOriginGuard, SessionGuard)
export class ClassesController {
  constructor(
    @Inject(CLASSES) private readonly classes: ClassRepository,
    @Inject(SAVED_LESSONS) private readonly saved: Pick<SavedLessonRepository, "get">,
  ) {}

  private async owned(account: StoredAccount, classId: string): Promise<StoredClass> {
    const found = await this.classes.getOwned(account.accountId, classId);
    if (!found) throw new UserFacingException(NOT_FOUND, HttpStatus.NOT_FOUND);
    return found;
  }

  private async view(account: StoredAccount, classId: string) {
    return { class: teacherView(await this.owned(account, classId)) };
  }

  @Post(API_ROUTES.becomeEducator.path)
  @HttpCode(200)
  async becomeEducator(
    @SignedInAccount() account: StoredAccount,
  ): Promise<ApiResponse<"becomeEducator">> {
    if (!account.emailVerifiedAt) {
      throw new UserFacingException(
        "Confirm your email address before turning on teaching tools.",
        HttpStatus.FORBIDDEN,
      );
    }
    // Ours, not the law's: a 13-year-old account shouldn't run a class of younger children.
    if (account.ageAtSignup < 18) {
      throw new UserFacingException(
        "Teaching tools are for adults aged 18 or over.",
        HttpStatus.FORBIDDEN,
      );
    }
    await this.classes.enableEducator(account.accountId, new Date());
    return { educator: true };
  }

  @Get(API_ROUTES.classes.path)
  async list(@SignedInAccount() account: StoredAccount): Promise<ApiResponse<"classes">> {
    const [educator, owned] = await Promise.all([
      this.classes.isEducator(account.accountId),
      this.classes.listOwned(account.accountId),
    ]);
    return { classes: owned.map(teacherView), educator };
  }

  @Post(API_ROUTES.createClass.path)
  @HttpCode(200)
  async create(
    @SignedInAccount() account: StoredAccount,
    @Body(new ZodPipe(CreateClassRequest, "Give the class a name of up to 60 characters."))
    { name, curriculum, level }: z.output<typeof CreateClassRequest>,
  ): Promise<ApiResponse<"createClass">> {
    if (!(await this.classes.isEducator(account.accountId))) {
      throw new UserFacingException("Turn on teaching tools first.", HttpStatus.FORBIDDEN);
    }
    checkLevel(curriculum, level);
    const open = (await this.classes.listOwned(account.accountId)).filter((c) => !c.archivedAt);
    if (open.length >= MAX_OPEN_CLASSES) {
      throw new UserFacingException(
        `You can have up to ${MAX_OPEN_CLASSES} classes. Archive one to make another.`,
        HttpStatus.CONFLICT,
      );
    }
    const classId = newId();
    for (let attempt = 0; ; attempt += 1) {
      const joinCode = newJoinCode();
      try {
        await this.classes.create({
          classId,
          controls: DEFAULT_CLASS_CONTROLS,
          createdAt: new Date(),
          curriculum,
          joinCodeHash: hashJoinCode(joinCode),
          joinCodeHint: codeHint(joinCode),
          level,
          name,
          ownerAccountId: account.accountId,
        });
        return { ...(await this.view(account, classId)), joinCode };
      } catch (error) {
        // A clash between two random 40-bit codes is rare; a third in a row is a real fault.
        if (!isDuplicate(error) || attempt >= 2) throw error;
      }
    }
  }

  @Post(API_ROUTES.updateClass.path)
  @HttpCode(200)
  async update(
    @SignedInAccount() account: StoredAccount,
    @Body(new ZodPipe(UpdateClassRequest, "Say which class to change, and how."))
    { classId, ...changes }: z.output<typeof UpdateClassRequest>,
  ): Promise<ApiResponse<"updateClass">> {
    const current = await this.owned(account, classId);
    const curriculum =
      changes.curriculum === undefined
        ? (current.curriculum as Curriculum | null)
        : changes.curriculum;
    // Changing curriculum drops a level that belonged to the old one, unless a new one is given.
    const level =
      changes.level !== undefined
        ? changes.level
        : changes.curriculum !== undefined
          ? null
          : current.level;
    checkLevel(curriculum, level);
    await this.classes.update(classId, {
      controls: changes.controls,
      curriculum,
      level,
      name: changes.name,
    });
    return this.view(account, classId);
  }

  @Post(API_ROUTES.rotateClassCode.path)
  @HttpCode(200)
  async rotate(
    @SignedInAccount() account: StoredAccount,
    @Body(new ZodPipe(ClassIdRequest, "Say which class needs a new code."))
    { classId }: z.output<typeof ClassIdRequest>,
  ): Promise<ApiResponse<"rotateClassCode">> {
    await this.owned(account, classId);
    for (let attempt = 0; ; attempt += 1) {
      const joinCode = newJoinCode();
      try {
        await this.classes.setJoinCode(classId, hashJoinCode(joinCode), codeHint(joinCode));
        return { ...(await this.view(account, classId)), joinCode };
      } catch (error) {
        if (!isDuplicate(error) || attempt >= 2) throw error;
      }
    }
  }

  @Post(API_ROUTES.archiveClass.path)
  @HttpCode(200)
  async archive(
    @SignedInAccount() account: StoredAccount,
    @Body(new ZodPipe(ArchiveClassRequest, "Say which class to archive or restore."))
    { classId, archived }: z.output<typeof ArchiveClassRequest>,
  ): Promise<ApiResponse<"archiveClass">> {
    await this.owned(account, classId);
    await this.classes.update(classId, { archivedAt: archived ? new Date() : null });
    return this.view(account, classId);
  }

  @Post(API_ROUTES.addClassLesson.path)
  @HttpCode(200)
  async addLesson(
    @SignedInAccount() account: StoredAccount,
    @Body(new ZodPipe(ClassLessonRequest, "Say which lesson to add to which class."))
    { classId, lessonId }: z.output<typeof ClassLessonRequest>,
  ): Promise<ApiResponse<"addClassLesson">> {
    const current = await this.owned(account, classId);
    // Only lessons the teacher saved, at the version they saved, so pupils see what was checked.
    const saved = await this.saved.get(account.accountId, lessonId);
    if (!saved) {
      throw new UserFacingException(
        "Save the lesson to your account first, then add it.",
        HttpStatus.NOT_FOUND,
      );
    }
    const already = current.lessons.some((lesson) => lesson.lessonId === lessonId);
    if (!already && current.lessons.length >= CLASS_LESSONS_MAX) {
      throw new UserFacingException(
        `A class can have up to ${CLASS_LESSONS_MAX} lessons.`,
        HttpStatus.CONFLICT,
      );
    }
    await this.classes.addLesson(classId, {
      addedAt: new Date(),
      lessonId,
      title: saved.title,
      version: saved.version,
    });
    return this.view(account, classId);
  }

  @Post(API_ROUTES.removeClassLesson.path)
  @HttpCode(200)
  async removeLesson(
    @SignedInAccount() account: StoredAccount,
    @Body(new ZodPipe(ClassLessonRequest, "Say which lesson to remove from which class."))
    { classId, lessonId }: z.output<typeof ClassLessonRequest>,
  ): Promise<ApiResponse<"removeClassLesson">> {
    await this.owned(account, classId);
    await this.classes.removeLesson(classId, lessonId);
    return this.view(account, classId);
  }
}
