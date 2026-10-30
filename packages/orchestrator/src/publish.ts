import type { Lesson, LessonDisclaimer } from "@sbi/contracts";
import type { CheckReport } from "./checks";

export type ReviewStatus = Lesson["reviewStatus"];

export interface PublishAudit {
  lessonId: string;
  version: number;
  from: ReviewStatus;
  to: ReviewStatus;
  by: string;
  at: string;
  reason?: string;
}

// Awaited, so a stored trail never misses a move that the caller already acted on.
export type PublishAuditSink = (audit: PublishAudit) => void | Promise<void>;

/** Durable review history: every move with who made it, when and why. */
export interface ReviewAuditLog {
  record(audit: PublishAudit): Promise<void>;
  /** Oldest first; all versions when `version` is omitted. */
  history(lessonId: string, version?: number): Promise<PublishAudit[]>;
}

export function createMemoryReviewAuditLog(): ReviewAuditLog {
  const audits: PublishAudit[] = [];
  return {
    async record(audit) {
      audits.push({ ...audit });
    },
    async history(lessonId, version) {
      return audits
        .filter(
          (audit) =>
            audit.lessonId === lessonId && (version === undefined || audit.version === version),
        )
        .map((audit) => ({ ...audit }));
    },
  };
}

export interface RightsDecision {
  cleared: boolean;
  reason?: string;
}

// Minimal gate until E8-6 lands the @sbi/rights publication block.
export interface RightsGate {
  check(lesson: Lesson): Promise<RightsDecision>;
}

export class RightsBlockedError extends Error {
  constructor(reason: string) {
    super(`Publication blocked by rights gate: ${reason}`);
    this.name = "RightsBlockedError";
  }
}

const ALLOWED: Record<ReviewStatus, ReviewStatus[]> = {
  generated: ["auto-validated", "needs-review"],
  "auto-validated": ["needs-review", "approved"],
  "needs-review": ["approved", "rejected"],
  approved: [],
  rejected: [],
};

/** Single owner of review transitions; every move returns its audit event. */
export function transitionLesson(
  lesson: Lesson,
  to: ReviewStatus,
  audit: { by: string; at?: string; reason?: string },
): { lesson: Lesson; audit: PublishAudit } {
  if (!ALLOWED[lesson.reviewStatus].includes(to)) {
    throw new Error(`Illegal review transition ${lesson.reviewStatus} -> ${to}`);
  }
  if (to === "rejected" && !audit.reason) {
    throw new Error("Rejections need a reason for rework");
  }
  const at = audit.at ?? new Date().toISOString();
  const decided = to === "approved" || to === "rejected";
  return {
    lesson: {
      ...lesson,
      reviewStatus: to,
      ...(decided ? { reviewedAt: at, reviewedBy: audit.by } : {}),
    },
    audit: {
      lessonId: lesson.lessonId,
      version: lesson.version,
      from: lesson.reviewStatus,
      to,
      by: audit.by,
      at,
      reason: audit.reason,
    },
  };
}

export interface RouteDecision {
  /** approve: serve as validated; disclose: serve with disclaimers while awaiting review; review: hold. */
  action: "approve" | "disclose" | "review";
  reasons: string[];
  disclaimers: LessonDisclaimer[];
}

// Failures a disclaimer can honestly describe; anything else (schema, citations, evidence,
// or an unknown check) means a statement may not trace to stored evidence, so it is held.
const DISCLOSABLE_CHECKS = new Set([
  "entailment",
  "contradictions",
  "misconceptions",
  "reading-level",
]);

export const GENERIC_SAFETY_NOTICE =
  "Safety first: this lesson explains the science only. It is not advice on using, handling or testing anything. Do not try this yourself; ask a responsible adult or a professional, and in an emergency call your local emergency number.";

export interface RouteOptions {
  /** Topic-specific safety wording for high-risk lessons; a generic notice is used otherwise. */
  safetyNotice?: string;
}

const AWAITING_REVIEW: LessonDisclaimer = {
  kind: "awaiting-review",
  message:
    "A reviewer has not checked this lesson yet. Treat it as a draft and report anything that looks wrong.",
  sectionIds: [],
};

function sectionsCiting(lesson: Lesson, claimIds: Set<string>): string[] {
  return lesson.sections
    .filter((section) => section.claimIds.some((id) => claimIds.has(id)))
    .map((section) => section.sectionId);
}

function disclaimersFor(
  lesson: Lesson,
  report: CheckReport | undefined,
  options: RouteOptions,
): LessonDisclaimer[] {
  // The safety notice leads, so it is the first thing shown with a risky topic.
  const notes: LessonDisclaimer[] =
    lesson.safetyClass === "high"
      ? [{ kind: "safety", message: options.safetyNotice ?? GENERIC_SAFETY_NOTICE, sectionIds: [] }]
      : [];
  notes.push(AWAITING_REVIEW);
  const failed = new Map(
    (report?.results ?? []).filter((item) => !item.passed).map((item) => [item.name, item]),
  );
  const unverified = failed.get("entailment")?.sections?.map((finding) => finding.sectionId) ?? [];
  if (failed.has("entailment")) {
    notes.push({
      kind: "unverified-sections",
      message:
        "Parts of this lesson say more than their sources show and have not been checked yet.",
      sectionIds: unverified,
    });
  }
  if (failed.has("contradictions")) {
    notes.push({
      kind: "sources-disagree",
      message: "Some of the sources behind this lesson disagree with each other.",
      sectionIds: [],
    });
  }
  const unsettled = new Set(
    lesson.claims
      .filter((claim) => claim.status === "disputed" || claim.status === "unsupported")
      .map((claim) => claim.claimId),
  );
  if (unsettled.size > 0 || failed.has("misconceptions")) {
    notes.push({
      kind: "open-questions",
      message: "Some statements here are still debated or not yet confirmed by a trusted source.",
      sectionIds: sectionsCiting(lesson, unsettled),
    });
  }
  const weak = new Set(
    lesson.claims.filter((claim) => claim.confidence === "low").map((claim) => claim.claimId),
  );
  if (weak.size > 0) {
    notes.push({
      kind: "limited-evidence",
      message: "Some statements rest on limited evidence.",
      sectionIds: sectionsCiting(lesson, weak),
    });
  }
  if (failed.has("reading-level")) {
    notes.push({
      kind: "reading-level",
      message: "This lesson may be harder to read than the level you chose.",
      sectionIds: [],
    });
  }
  return notes;
}

// Integrity failures wait for a human; other doubts, high-risk topics included (owner's
// decision, ADR 0010), are served with disclaimers while the lesson awaits review.
export function routeLesson(
  lesson: Lesson,
  report?: CheckReport,
  options: RouteOptions = {},
): RouteDecision {
  const reasons: string[] = [];
  const failed = report && !report.passed ? report.results.filter((item) => !item.passed) : [];
  if (failed.length > 0) {
    reasons.push(`automated checks failed: ${failed.map((item) => item.name).join(", ")}`);
  }
  if (lesson.safetyClass === "high") reasons.push("safety class high");
  for (const claim of lesson.claims) {
    if (claim.confidence === "low") reasons.push(`claim ${claim.claimId} confidence low`);
    if (claim.status === "disputed" || claim.status === "unsupported") {
      reasons.push(`claim ${claim.claimId} is ${claim.status}`);
    }
  }
  if (reasons.length === 0) return { action: "approve", reasons, disclaimers: [] };
  const hold = failed.some((item) => !DISCLOSABLE_CHECKS.has(item.name));
  return hold
    ? { action: "review", reasons, disclaimers: [] }
    : { action: "disclose", reasons, disclaimers: disclaimersFor(lesson, report, options) };
}

export interface Publisher {
  /** Moves disclosed and held lessons to needs-review; disclosed ones carry their disclaimers. */
  route(
    lesson: Lesson,
    report?: CheckReport,
    options?: RouteOptions,
  ): Promise<{ lesson: Lesson; decision: RouteDecision }>;
  approve(lesson: Lesson, by: string): Promise<Lesson>;
  reject(lesson: Lesson, by: string, reason: string): Promise<Lesson>;
}

export function createPublisher(deps: {
  rights: RightsGate;
  onAudit?: PublishAuditSink;
}): Publisher {
  return {
    async route(lesson, report, options = {}) {
      let decision = routeLesson(lesson, report, options);
      // Anything served, validated or disclosed, must clear rights just as approvals do.
      if (decision.action !== "review") {
        const rights = await deps.rights.check(lesson);
        if (!rights.cleared) {
          decision = {
            action: "review",
            reasons: [`rights: ${rights.reason ?? "not cleared"}`],
            disclaimers: [],
          };
        } else if (decision.action === "approve") {
          return { lesson, decision };
        }
      }
      const moved = transitionLesson(lesson, "needs-review", {
        by: "system",
        reason: decision.reasons.join("; "),
      });
      await deps.onAudit?.(moved.audit);
      const routed =
        decision.action === "disclose"
          ? { ...moved.lesson, disclaimers: decision.disclaimers }
          : moved.lesson;
      return { lesson: routed, decision };
    },

    async approve(lesson, by) {
      const decision = await deps.rights.check(lesson);
      if (!decision.cleared) {
        throw new RightsBlockedError(decision.reason ?? "no reason given");
      }
      const moved = transitionLesson(lesson, "approved", { by });
      await deps.onAudit?.(moved.audit);
      return moved.lesson;
    },

    async reject(lesson, by, reason) {
      const moved = transitionLesson(lesson, "rejected", { by, reason });
      await deps.onAudit?.(moved.audit);
      return moved.lesson;
    },
  };
}
