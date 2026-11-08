import { createHash, randomInt } from "node:crypto";
import { JoinCode, normaliseJoinCode } from "@sbi/contracts";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** A fresh 8-character code (40 bits), shown to the teacher as ABCD-EFGH. */
export function newJoinCode(): string {
  const chars = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

/** The stored form: only the SHA-256 of the canonical code (ADR 0027). */
export function hashJoinCode(code: string): string {
  return createHash("sha256").update(normaliseJoinCode(code)).digest("hex");
}

export const codeHint = (code: string) => normaliseJoinCode(code).slice(-2);

/** The canonical code, or undefined when it can't be one, so lookups never hit the database. */
export function parseJoinCode(code: string): string | undefined {
  const parsed = JoinCode.safeParse(code);
  return parsed.success ? parsed.data : undefined;
}
