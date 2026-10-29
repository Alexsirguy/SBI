import { describe, expect, it } from "vitest";
import type { Lesson } from "@sbi/contracts";
import {
  createPublisher,
  RightsBlockedError,
  routeLesson,
  transitionLesson,
  type PublishAudit,
  type RightsGate,
} from "./publish";
import { makeLesson } from "./lesson-fixture";

const cleared: RightsGate = { check: async () => ({ cleared: true }) };
const blocked: RightsGate = { check: async () => ({ cleared: false, reason: "licence pending" }) };

function autoValidated(): Lesson {
  return makeLesson({ reviewStatus: "auto-validated" });
}

describe("transitionLesson", () => {
  it("walks the full review path with an audit per move", () => {
    const first = transitionLesson(makeLesson(), "auto-validated", { by: "system" });
    const second = transitionLesson(first.lesson, "needs-review", { by: "system" });
    const third = transitionLesson(second.lesson, "approved", { by: "reviewer" });

    expect(third.lesson.reviewStatus).toBe("approved");
    expect(third.lesson.reviewedBy).toBe("reviewer");
    expect(third.lesson.reviewedAt).toBe(third.audit.at);
    expect([first.audit, second.audit, third.audit].map((audit) => audit.to)).toEqual([
      "auto-validated",
      "needs-review",
      "approved",
    ]);
  });

  it("rejects illegal moves and reasonless rejections", () => {
    expect(() => transitionLesson(makeLesson(), "approved", { by: "reviewer" })).toThrow(
      "Illegal review transition generated -> approved",
    );
    expect(() => transitionLesson(autoValidated(), "rejected", { by: "reviewer" })).toThrow(
      "Illegal review transition auto-validated -> rejected",
    );
    expect(() => transitionLesson(autoValidated(), "needs-review", { by: "system" })).not.toThrow();
    const review = transitionLesson(autoValidated(), "needs-review", { by: "system" }).lesson;
    expect(() => transitionLesson(review, "rejected", { by: "reviewer" })).toThrow(
      "Rejections need a reason",
    );
  });
});

describe("routeLesson", () => {
  it("sends risky or failed lessons to review", () => {
    expect(routeLesson(autoValidated()).action).toBe("approve");
    expect(routeLesson(makeLesson({ safetyClass: "high" })).action).toBe("review");

    const lesson = makeLesson();
    const [first, second] = lesson.claims;
    if (!first || !second) throw new Error("Fixture needs two claims");
    const lowConfidence: Lesson = {
      ...lesson,
      claims: [{ ...first, confidence: "low" }, second],
    };
    expect(routeLesson(lowConfidence).action).toBe("review");

    const report = {
      lessonId: lesson.lessonId,
      version: 1,
      passed: false,
      results: [{ name: "entailment", passed: false, details: ["unsupported"] }],
      checkedAt: new Date().toISOString(),
    };
    const routed = routeLesson(autoValidated(), report);
    expect(routed.action).toBe("review");
    expect(routed.reasons.join(";")).toContain("entailment");
  });
});

describe("createPublisher", () => {
  it("routes risky lessons and audits the move", async () => {
    const audits: PublishAudit[] = [];
    const publisher = createPublisher({ rights: cleared, onAudit: (audit) => audits.push(audit) });

    const { lesson, decision } = await publisher.route(makeLesson({ safetyClass: "high" }));

    expect(decision.action).toBe("review");
    expect(lesson.reviewStatus).toBe("needs-review");
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ from: "generated", to: "needs-review", by: "system" });
  });

  it("holds a clean lesson for review when its rights are not cleared", async () => {
    const audits: PublishAudit[] = [];
    const publisher = createPublisher({ rights: blocked, onAudit: (audit) => audits.push(audit) });

    const { lesson, decision } = await publisher.route(autoValidated());

    expect(decision).toEqual({ action: "review", reasons: ["rights: licence pending"] });
    expect(lesson.reviewStatus).toBe("needs-review");
    expect(audits[0]).toMatchObject({ from: "auto-validated", to: "needs-review" });
  });

  it("lets a clean lesson through when its rights clear", async () => {
    const { lesson, decision } = await createPublisher({ rights: cleared }).route(autoValidated());
    expect(decision.action).toBe("approve");
    expect(lesson.reviewStatus).toBe("auto-validated");
  });

  it("approves clean lessons once rights clear, and stamps the reviewer", async () => {
    const publisher = createPublisher({ rights: cleared });

    const approved = await publisher.approve(autoValidated(), "reviewer");

    expect(approved.reviewStatus).toBe("approved");
    expect(approved.reviewedBy).toBe("reviewer");
  });

  it("blocks approval when rights refuse, leaving state untouched", async () => {
    const audits: PublishAudit[] = [];
    const publisher = createPublisher({ rights: blocked, onAudit: (audit) => audits.push(audit) });

    await expect(publisher.approve(autoValidated(), "reviewer")).rejects.toThrow(
      RightsBlockedError,
    );
    await expect(publisher.approve(autoValidated(), "reviewer")).rejects.toThrow("licence pending");
    expect(audits).toHaveLength(0);
  });

  it("rejects with a recorded reason", async () => {
    const publisher = createPublisher({ rights: cleared });
    const review = transitionLesson(autoValidated(), "needs-review", { by: "system" }).lesson;

    const rejected = await publisher.reject(review, "reviewer", "Claims too thin");

    expect(rejected.reviewStatus).toBe("rejected");
    expect(rejected.reviewedBy).toBe("reviewer");
  });
});
