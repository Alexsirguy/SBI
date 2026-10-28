import {
  Catch,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import type { ApiError } from "@sbi/contracts";
import type { z } from "zod";
import { UserFacingException } from "./user-facing.exception";

const GENERIC: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: "The request could not be read.",
  [HttpStatus.NOT_FOUND]: "Not found.",
};

// Fastify rejects unreadable bodies with plain errors that carry a 4xx `statusCode`.
function statusOf(exception: unknown): number {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }
  const status = (exception as { statusCode?: unknown } | null)?.statusCode;
  return typeof status === "number" && status >= 400 && status < 500
    ? status
    : HttpStatus.INTERNAL_SERVER_ERROR;
}

// Every failure leaves in the contract's `{ error }` shape.
@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  constructor(@Inject(HttpAdapterHost) private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const status = statusOf(exception);
    if (status >= 500 && !(exception instanceof HttpException)) {
      this.logger.error(exception instanceof Error ? exception.message : "Unhandled error");
    }
    const error =
      exception instanceof UserFacingException
        ? exception.message
        : (GENERIC[status] ??
          (status < 500 ? "The request was refused." : "Something went wrong."));
    this.adapterHost.httpAdapter.reply(
      host.switchToHttp().getResponse<unknown>(),
      { error } satisfies z.output<typeof ApiError>,
      status,
    );
  }
}
