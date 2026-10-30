import { describe, expect, it } from "vitest";
import { Lesson } from "@sbi/contracts";
import {
  createMemoryReviewAuditLog,
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
  it("holds high-risk lessons and integrity failures, and discloses softer doubts", () => {
    expect(routeLesson(autoValidated()).action).toBe("approve");
    expect(routeLesson(makeLesson({ safetyClass: "high" })).action).toBe("review");

    const lesson = makeLesson();
    const [first, second] = lesson.claims;
    if (!first || !second) throw new Error("Fixture needs two claims");
    const lowConfidence: Lesson = {
      ...lesson,
      claims: [{ ...first, confidence: "low" }, second],
    };
    const weak = routeLesson(lowConfidence);
    expect(weak.action).toBe("disclose");
    expect(weak.disclaimers.map((item) => item.kind)).toEqual([
      "awaiting-review",
      "limited-evidence",
    ]);
    expect(weak.disclaimers[1]?.sectionIds.length).toBeGreaterThan(0);

    const failing = (name: string, sections?: { sectionId: string; reason: string }[]) => ({
      lessonId: lesson.lessonId,
      version: 1,
      passed: false,
      results: [{ name, passed: false, details: ["x"], sections }],
      checkedAt: new Date().toISOString(),
    });
    const unverified = routeLesson(
      autoValidated(),
      failing("entailment", [{ sectionId: "first-principles-3", reason: "adds detail" }]),
    );
    expect(unverified.action).toBe("disclose");
    expect(
      unverified.disclaimers.find((item) => item.kind === "unverified-sections")?.sectionIds,
    ).toEqual(["first-principles-3"]);
    expect(routeLesson(autoValidated(), failing("reading-level")).action).toBe("disclose");
    for (const name of ["schema", "citations", "evidence", "something-new"]) {
      expect(routeLesson(autoValidated(), failing(name)).action).toBe("review");
    }
    expect(routeLesson(makeLesson({ safetyClass: "high" }), failing("reading-level")).action).toBe(
      "review",
    );
  });
});

describe("createPublisher", () => {
  it("routes risky lessons and audits the move", async () => {
    const audits: PublishAudit[] = [];
    const publisher = createPublisher({
      rights: cleared,
      onAudit: (audit) => void audits.push(audit),
    });

    const { lesson, decision } = await publisher.route(makeLesson({ safetyClass: "high" }));

    expect(decision.action).toBe("review");
    expect(lesson.reviewStatus).toBe("needs-review");
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ from: "generated", to: "needs-review", by: "system" });
  });

  it("holds a clean lesson for review when its rights are not cleared", async () => {
    const audits: PublishAudit[] = [];
    const publisher = createPublisher({
      rights: blocked,
      onAudit: (audit) => void audits.push(audit),
    });

    const { lesson, decision } = await publisher.route(autoValidated());

    expect(decision).toEqual({
      action: "review",
      reasons: ["rights: licence pending"],
      disclaimers: [],
    });
    expect(lesson.reviewStatus).toBe("needs-review");
    expect(audits[0]).toMatchObject({ from: "auto-validated", to: "needs-review" });
  });

  it("serves a disclosed lesson as needs-review with its disclaimers, audited", async () => {
    const audits: PublishAudit[] = [];
    const lesson = makeLesson();
    const [first, second] = lesson.claims;
    if (!first || !second) throw new Error("Fixture needs two claims");
    const { lesson: routed, decision } = await createPublisher({
      rights: cleared,
      onAudit: (audit) => void audits.push(audit),
    }).route({ ...lesson, claims: [{ ...first, confidence: "low" }, second] });
    expect(decision.action).toBe("disclose");
    expect(routed.reviewStatus).toBe("needs-review");
    expect(routed.disclaimers?.[0]?.kind).toBe("awaiting-review");
    expect(Lesson.parse(routed)).toEqual(routed);
    expect(audits[0]).toMatchObject({ to: "needs-review" });
  });

  it("holds instead of disclosing when rights are not cleared", async () => {
    const lesson = makeLesson();
    const [first, second] = lesson.claims;
    if (!first || !second) throw new Error("Fixture needs two claims");
    const { lesson: routed, decision } = await createPublisher({ rights: blocked }).route({
      ...lesson,
      claims: [{ ...first, confidence: "low" }, second],
    });
    expect(decision.action).toBe("review");
    expect(routed.disclaimers).toBeUndefined();
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
    const publisher = createPublisher({
      rights: blocked,
      onAudit: (audit) => void audits.push(audit),
    });

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

  it("stores every move in the review log before returning", async () => {
    const log = createMemoryReviewAuditLog();
    const publisher = createPublisher({ rights: cleared, onAudit: (audit) => log.record(audit) });

    const { lesson: held } = await publisher.route(makeLesson({ safetyClass: "high" }));
    const approved = await publisher.approve(held, "editor-7");

    expect(approved.reviewedBy).toBe("editor-7");
    expect(
      (await log.history(held.lessonId)).map(({ from, to, by }) => ({ from, to, by })),
    ).toEqual([
      { from: "generated", to: "needs-review", by: "system" },
      { from: "needs-review", to: "approved", by: "editor-7" },
    ]);
    expect(await log.history(held.lessonId, 2)).toEqual([]);
  });
});
