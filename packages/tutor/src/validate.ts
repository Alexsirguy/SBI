import type { Claim } from "@sbi/contracts";
import { factRef, type DraftAnswer } from "./answer";

/** Three short sentences fit well inside this; anything longer is the lecture the owner ruled out. */
export const REPLY_MAX_CHARS = 600;

export type Validated =
  | { ok: true; text: string; citedClaimIds: string[] }
  | { ok: false; reason: "empty" | "too-long" | "unknown-citation" };

/** Checks a draft before the learner sees it; any failure means a retry, never a partial reply. */
export function validateAnswer(draft: DraftAnswer, retrieved: readonly Claim[]): Validated {
  const text = draft.text.trim().replace(/\s+/g, " ");
  if (!text) return { ok: false, reason: "empty" };
  if (text.length > REPLY_MAX_CHARS) return { ok: false, reason: "too-long" };
  const byRef = new Map(retrieved.map((claim, index) => [factRef(index), claim.claimId]));
  const citedClaimIds: string[] = [];
  for (const ref of draft.cited) {
    const claimId = byRef.get(ref.trim().toLowerCase());
    if (!claimId) return { ok: false, reason: "unknown-citation" };
    if (!citedClaimIds.includes(claimId)) citedClaimIds.push(claimId);
  }
  return { ok: true, text, citedClaimIds };
}
