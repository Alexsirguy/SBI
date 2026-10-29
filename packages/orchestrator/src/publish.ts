import type { Lesson } from "@sbi/contracts";
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
  action: "approve" | "review";
  reasons: string[];
}

// High-risk or low-confidence lessons go to a human; the rest may auto-approve.
export function routeLesson(lesson: Lesson, report?: CheckReport): RouteDecision {
  const reasons: string[] = [];
  if (report && !report.passed) {
    const failed = report.results.filter((item) => !item.passed).map((item) => item.name);
    reasons.push(`automated checks failed: ${failed.join(", ")}`);
  }
  if (lesson.safetyClass === "high") reasons.push("safety class high");
  for (const claim of lesson.claims) {
    if (claim.confidence === "low") reasons.push(`claim ${claim.claimId} confidence low`);
    if (claim.status === "disputed" || claim.status === "unsupported") {
      reasons.push(`claim ${claim.claimId} is ${claim.status}`);
    }
  }
  return reasons.length === 0 ? { action: "approve", reasons } : { action: "review", reasons };
}

export interface Publisher {
  /** Moves review-bound or rights-blocked lessons to needs-review; clean ones pass through. */
  route(lesson: Lesson, report?: CheckReport): Promise<{ lesson: Lesson; decision: RouteDecision }>;
  approve(lesson: Lesson, by: string): Promise<Lesson>;
  reject(lesson: Lesson, by: string, reason: string): Promise<Lesson>;
}

export function createPublisher(deps: {
  rights: RightsGate;
  onAudit?: PublishAuditSink;
}): Publisher {
  return {
    async route(lesson, report) {
      let decision = routeLesson(lesson, report);
      // Auto-validated lessons are served, so they must clear rights just as approvals do.
      if (decision.action === "approve") {
        const rights = await deps.rights.check(lesson);
        if (rights.cleared) return { lesson, decision };
        decision = { action: "review", reasons: [`rights: ${rights.reason ?? "not cleared"}`] };
      }
      const moved = transitionLesson(lesson, "needs-review", {
        by: "system",
        reason: decision.reasons.join("; "),
      });
      await deps.onAudit?.(moved.audit);
      return { lesson: moved.lesson, decision };
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
