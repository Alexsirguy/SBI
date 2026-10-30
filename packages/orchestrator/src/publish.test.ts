import { describe, expect, it } from "vitest";
import { Lesson } from "@sbi/contracts";
import {
  createMemoryReviewAuditLog,
  createPublisher,
  GENERIC_SAFETY_NOTICE,
  MODEL_KNOWLEDGE_DISCLAIMER,
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
  it("holds integrity failures and discloses everything else, safety first on risky topics", () => {
    expect(routeLesson(autoValidated()).action).toBe("approve");
    const risky = routeLesson(makeLesson({ safetyClass: "high" }));
    expect(risky.action).toBe("disclose");
    expect(risky.disclaimers.map((item) => item.kind)).toEqual(["safety", "awaiting-review"]);
    expect(risky.disclaimers[0]?.message).toBe(GENERIC_SAFETY_NOTICE);

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
      "disclose",
    );
    expect(routeLesson(makeLesson({ safetyClass: "high" }), failing("evidence")).action).toBe(
      "review",
    );
  });
});

describe("routeLesson with model knowledge", () => {
  const withModel = (overrides: Record<string, unknown> = {}): Lesson => {
    const lesson = makeLesson({ reviewStatus: "auto-validated", ...overrides });
    const model = {
      claimId: "0192f1a0-0000-7000-8000-0000000000aa",
      text: "Kettles were electrified in the late nineteenth century.",
      status: "unsupported" as const,
      origin: "model" as const,
      sourceIds: [],
      scope: "general knowledge: history",
      confidence: "low" as const,
      uncertainty: "From the AI's general knowledge; not yet checked against a source.",
      dependsOn: [],
    };
    return {
      ...lesson,
      claims: [...lesson.claims, model],
      sections: lesson.sections.map((section, index) =>
        index === 0 ? { ...section, claimIds: [...section.claimIds, model.claimId] } : section,
      ),
    };
  };

  it("discloses with one lesson-level notice instead of holding or listing open questions", () => {
    const decision = routeLesson(withModel());
    expect(decision.action).toBe("disclose");
    expect(decision.disclaimers).toEqual([MODEL_KNOWLEDGE_DISCLAIMER]);
    expect(decision.reasons).toEqual(["1 claims from model knowledge"]);
  });

  it("keeps the safety notice first on a high-risk topic", () => {
    const decision = routeLesson(withModel({ safetyClass: "high" }));
    expect(decision.disclaimers.map((item) => item.kind)).toEqual(["safety", "model-knowledge"]);
  });
});

describe("createPublisher", () => {
  it("routes risky lessons and audits the move", async () => {
    const audits: PublishAudit[] = [];
    const publisher = createPublisher({
      rights: cleared,
      onAudit: (audit) => void audits.push(audit),
    });

    const { lesson, decision } = await publisher.route(
      makeLesson({ safetyClass: "high" }),
      undefined,
      {
        safetyNotice: "Medicines: never take or give medicine because of this lesson.",
      },
    );

    expect(decision.action).toBe("disclose");
    expect(lesson.reviewStatus).toBe("needs-review");
    expect(lesson.disclaimers?.[0]).toEqual({
      kind: "safety",
      message: "Medicines: never take or give medicine because of this lesson.",
      sectionIds: [],
    });
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
