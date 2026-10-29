import { Body, Controller, Inject, Post, Res } from "@nestjs/common";
import type { ServerResponse } from "node:http";
import { API_ROUTES, LessonRequest } from "@sbi/contracts";
import { UserFacingException } from "../common/user-facing.exception";
import { ZodPipe } from "../common/zod.pipe";
import { LessonService, type LessonStreamEvent } from "./lesson.service";

interface RawResponse {
  raw: ServerResponse;
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
  constructor(@Inject(LessonService) private readonly lessons: LessonService) {}

  @Post(API_ROUTES.requestLesson.path)
  async stream(
    @Body(new ZodPipe(LessonRequest, "Ask a question of at least 3 characters."))
    body: LessonRequest,
    @Res() res: RawResponse,
  ): Promise<void> {
    const events = this.lessons.streamLesson(body);
    const first = await events.next();
    // Headers wait for the first event, so pre-stream failures still map to HTTP errors.
    res.raw.writeHead(200, STREAM_HEADERS);
    try {
      if (!first.done) res.raw.write(frame(first.value));
      for await (const event of events) res.raw.write(frame(event));
    } catch (error) {
      // Later stages resolve between events; failures must end the stream, not hang it.
      const message =
        error instanceof UserFacingException ? error.message : "Something went wrong.";
      res.raw.write(frame({ type: "error", data: { error: message } }));
    } finally {
      res.raw.end();
    }
  }
}
