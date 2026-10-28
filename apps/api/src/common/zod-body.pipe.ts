import { HttpStatus, type PipeTransform } from "@nestjs/common";
import type { z } from "zod";
import { UserFacingException } from "./user-facing.exception";

// Contracts are Zod schemas, so request bodies are validated by the same rules clients share.
export class ZodBodyPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(
    private readonly schema: S,
    private readonly message: string,
  ) {}

  transform(value: unknown): z.output<S> {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new UserFacingException(this.message, HttpStatus.BAD_REQUEST);
    }
    return parsed.data;
  }
}
