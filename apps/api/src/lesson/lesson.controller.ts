import { Body, Controller, Inject, Logger, Post, Req, Res } from "@nestjs/common";
import type { ServerResponse } from "node:http";
import { API_ROUTES, LessonRequest } from "@sbi/contracts";
import type { SavedLessonRepository } from "@sbi/db";
import { sessionToken, type SessionRequest } from "../account/account.guard";
import { AuthService } from "../account/auth.service";
import { UserFacingException } from "../common/user-facing.exception";
import { ZodPipe } from "../common/zod.pipe";
import { SAVED_LESSONS } from "../tokens";
import { LessonService, type LessonStreamEvent } from "./lesson.service";

const logger = new Logger("LessonController");

interface RawResponse {
  raw: ServerResponse;
  /** Headers Fastify's hooks already set on the reply, CORS among them. */
  getHeaders(): Record<string, string | string[] | number | undefined>;
}

// Writing to the raw response skips Fastify's own send, so its headers must be carried over.
function streamHeaders(res: RawResponse): Record<string, string | string[] | number> {
  const carried = Object.entries(res.getHeaders()).filter(
    (entry): entry is [string, string | string[] | number] => entry[1] !== undefined,
  );
  return { ...Object.fromEntries(carried), ...STREAM_HEADERS };
}

const STREAM_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;

function frame(event: LessonStreamEvent | { type: "error"; data: { error: string } }): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

@Controller()
export class LessonController {
  constructor(
    @Inject(LessonService) private readonly lessons: LessonService,
    @Inject(AuthService) private readonly auth: Pick<AuthService, "current">,
    @Inject(SAVED_LESSONS) private readonly saved: Pick<SavedLessonRepository, "list">,
  ) {}

  // Lessons work signed out; a session only adds the asker's own saved lessons to reuse (#342).
  private async ownLessonIds(request: SessionRequest): Promise<Set<string> | undefined> {
    const account = await this.auth.current(sessionToken(request)).catch(() => undefined);
    if (!account) return undefined;
    return new Set((await this.saved.list(account.accountId)).map((item) => item.lessonId));
  }

  @Post(API_ROUTES.requestLesson.path)
  async stream(
    @Body(new ZodPipe(LessonRequest, "Ask a question of at least 3 characters."))
    body: LessonRequest,
    @Req() request: SessionRequest,
    @Res() res: RawResponse,
  ): Promise<void> {
    const events = this.lessons.streamLesson(body, {
      ownLessonIds: await this.ownLessonIds(request),
    });
    const first = await events.next();
    // Headers wait for the first event, so pre-stream failures still map to HTTP errors.
    res.raw.writeHead(200, streamHeaders(res));
    try {
      if (!first.done) res.raw.write(frame(first.value));
      for await (const event of events) res.raw.write(frame(event));
    } catch (error) {
      // Later stages resolve between events; failures must end the stream, not hang it.
      if (!(error instanceof UserFacingException)) {
        logger.error(`Lesson stream failed: ${(error as Error)?.stack ?? String(error)}`);
      }
      const message =
        error instanceof UserFacingException ? error.message : "Something went wrong.";
      res.raw.write(frame({ type: "error", data: { error: message } }));
    } finally {
      res.raw.end();
    }
  }
}
