import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

export const Id = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/, "Use letters, digits, '.', '_', ':' or '-'");

/** System-generated record ids; readable `Id`s are kept for canonical keys like taxonomy paths. */
export const Uuid = z.uuid();

/** Time-ordered UUIDv7, so new rows append to the end of database indexes. */
export function newId(): string {
  return uuidv7();
}

export const IsoDate = z.iso.date();
export const IsoDateTime = z.iso.datetime({ offset: true });

export const Sha256 = z.string().regex(/^[a-f0-9]{64}$/, "Expected a lowercase hex SHA-256 digest");

export const Locale = z
  .string()
  .regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, "Expected a locale like 'en' or 'en-GB'");

export const Confidence = z.enum(["high", "medium", "low"]);

export const SafetyClass = z.enum(["low", "medium", "high"]);
export type SafetyClass = z.infer<typeof SafetyClass>;
