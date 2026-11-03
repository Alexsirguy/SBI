import { Lesson, lessonContentHash, newId } from "@sbi/contracts";
import { transitionLesson, type PublishAudit } from "./publish";

export class NotShareableError extends Error {}

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
// International or long spaced numbers only, so dates, years and quantities are left alone.
const PHONE = /\+\d[\d ()-]{7,}\d|\b\d{3,5}[ ]\d{3,4}[ ]\d{3,4}\b/g;
// Ids, hashes and links are structure, not prose, and must survive untouched.
const STRUCTURAL_KEY = /(Id|Ids|id|url|Url|Hash|hash|Signature|locator)$/;

export function redactContact(text: string): string {
  return text.replace(EMAIL, "[email removed]").replace(PHONE, "[number removed]");
}

function scrub(value: unknown, key = ""): unknown {
  if (typeof value === "string") return STRUCTURAL_KEY.test(key) ? value : redactContact(value);
  if (Array.isArray(value)) return value.map((item) => scrub(item, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([name, item]) => [name, scrub(item, name)]),
    );
  }
  return value;
}

/**
 * An anonymous copy of a learner's lesson for others to reuse once a reviewer approves it.
 * Provenance (evidence snapshot, model, prompt and policy versions) is kept; the learner is not.
 */
export async function shareLesson(
  source: Lesson,
  { now = new Date(), id = newId } = {},
): Promise<{ lesson: Lesson; audit: PublishAudit }> {
  if (source.reuse.cacheScope === "shared") {
    throw new NotShareableError("This lesson is already shared with other learners.");
  }
  if (source.reviewStatus === "rejected" || source.reviewStatus === "generated") {
    throw new NotShareableError("Only lessons that passed their checks can be shared.");
  }
  const at = now.toISOString();
  const scrubbed = scrub({ ...source, assumptions: [] }) as Lesson;
  const copy = Lesson.parse({
    ...scrubbed,
    // Assumptions are the asker's own words about their situation, so they stay with them.
    assumptions: [],
    lessonId: id(),
    version: 1,
    reviewStatus: "generated",
    reviewedAt: undefined,
    reviewedBy: undefined,
    reuse: {
      ...source.reuse,
      cacheScope: "shared",
      reuseCount: 0,
      invalidationReason: undefined,
      lastUserConfirmationAt: at,
    },
  });
  const hashed = { ...copy, reuse: { ...copy.reuse, contentHash: await lessonContentHash(copy) } };
  // Into review, never straight to other learners; the trail says where the copy came from.
  return transitionLesson(hashed, "needs-review", {
    at,
    by: "learner-share",
    reason: `Shared by a learner from lesson ${source.lessonId} v${source.version}`,
  });
}
