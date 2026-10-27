import type { z } from "zod";

/** Re-validates stored documents so schema drift surfaces at read time, not in callers. */
export function parseDocuments<T extends z.ZodType>(
  schema: T,
  rows: { document: unknown }[],
): z.output<T>[] {
  return rows.map((row) => schema.parse(row.document));
}
