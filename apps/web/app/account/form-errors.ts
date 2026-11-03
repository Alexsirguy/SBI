import type { z } from "zod";

/** Our own wording per field and issue code, e.g. `{ email: { invalid_format: "…" } }`. */
export type FieldMessages = Partial<Record<string, Partial<Record<string, string>>>>;

/** A schema issue in the page's language; anything not mapped keeps the schema's message. */
export function issueMessage(issue: z.core.$ZodIssue, messages: FieldMessages): string {
  return messages[String(issue.path[0] ?? "")]?.[issue.code] ?? issue.message;
}

/** First message per field, so each input shows one clear error beside it. */
export function fieldErrors(error: z.ZodError, messages: FieldMessages): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    errors[field] ??= issueMessage(issue, messages);
  }
  return errors;
}
