import type { z } from "zod";
import { EnvError } from "./env-error";

export type EnvSource = Record<string, string | undefined>;

export function createEnv<T extends z.ZodType>(schema: T, source: EnvSource): z.output<T> {
  // Empty values from .env templates mean "unset", not "empty string".
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ""));
  const result = schema.safeParse(cleaned);

  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `  ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new EnvError(`Invalid environment variables:\n${problems.join("\n")}`);
  }

  return result.data;
}
