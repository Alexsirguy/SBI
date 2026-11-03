import type { AudienceBand, Claim, TutorReplyKind } from "@sbi/contracts";
import { findUnsafeActivities, safeActivityRulesApply } from "@sbi/safety";
import { factRef, type DraftAnswer } from "./answer";

/** Three short sentences fit well inside this; anything longer is the lecture the owner ruled out. */
export const REPLY_MAX_CHARS = 600;

/** A clarifying question is one short sentence; longer is an answer dressed up as a question. */
export const CLARIFYING_MAX_CHARS = 160;

// The tutor never sees the photo, so a reply claiming to is inventing details (#95).
const CLAIMS_TO_SEE =
  /\b(I can see|I see that|in your (photo|picture|image)|your (photo|picture|image) shows|en tu (foto|imagen)|veo que|se ve que)\b/i;

export type Validated =
  | {
      ok: true;
      kind: Extract<TutorReplyKind, "lesson" | "beyond-lesson" | "clarifying">;
      text: string;
      citedClaimIds: string[];
    }
  | {
      ok: false;
      reason:
        | "empty"
        | "too-long"
        | "unknown-citation"
        | "claims-to-see"
        | "unsafe-activity"
        | "not-a-question"
        | "clarified-twice";
    };

/** Checks a draft before the learner sees it; any failure means a retry, never a partial reply. */
export function validateAnswer(
  draft: Pick<DraftAnswer, "kind" | "text" | "cited">,
  retrieved: readonly Claim[],
  options: { justClarified?: boolean; audience?: AudienceBand } = {},
): Validated {
  const text = draft.text.trim().replace(/\s+/g, " ");
  if (!text) return { ok: false, reason: "empty" };
  if (text.length > REPLY_MAX_CHARS) return { ok: false, reason: "too-long" };
  if (CLAIMS_TO_SEE.test(text)) return { ok: false, reason: "claims-to-see" };
  // Off-lesson answers skip the lesson's activity check, so the tutor applies it to every reply.
  const childMayRead = safeActivityRulesApply([options.audience ?? "general"]);
  if (childMayRead && findUnsafeActivities(text).length > 0) {
    return { ok: false, reason: "unsafe-activity" };
  }

  if (draft.kind === "clarify") {
    if (options.justClarified) return { ok: false, reason: "clarified-twice" };
    const oneQuestion = text.endsWith("?") && text.split("?").length === 2;
    if (!oneQuestion || text.length > CLARIFYING_MAX_CHARS) {
      return { ok: false, reason: "not-a-question" };
    }
    return { ok: true, kind: "clarifying", text, citedClaimIds: [] };
  }

  const byRef = new Map(retrieved.map((claim, index) => [factRef(index), claim.claimId]));
  const citedClaimIds: string[] = [];
  for (const ref of draft.cited) {
    const claimId = byRef.get(ref.trim().toLowerCase());
    if (!claimId) return { ok: false, reason: "unknown-citation" };
    if (!citedClaimIds.includes(claimId)) citedClaimIds.push(claimId);
  }
  // Kind follows the citations, not the model's label, so an uncited reply always gets the note.
  const kind = citedClaimIds.length > 0 ? "lesson" : "beyond-lesson";
  return { ok: true, kind, text, citedClaimIds };
}
