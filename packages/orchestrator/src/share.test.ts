import { describe, expect, it } from "vitest";
import { makeLesson } from "./lesson-fixture";
import { NotShareableError, redactContact, shareLesson } from "./share";

const COPY_ID = "123e4567-e89b-12d3-a456-4266141740ff";
const NOW = new Date("2026-11-03T12:00:00.000Z");

function personal() {
  const lesson = makeLesson({ reviewStatus: "auto-validated" });
  return {
    ...lesson,
    summary: "Ask Ada at ada@example.com or call +44 20 7946 0958 about kettles boiled in 2026-11.",
  };
}

describe("shareLesson", () => {
  it("copies the lesson into review with provenance kept and a new identity", async () => {
    const source = personal();
    const { lesson, audit } = await shareLesson(source, { id: () => COPY_ID, now: NOW });

    expect(lesson.lessonId).toBe(COPY_ID);
    expect(lesson.version).toBe(1);
    expect(lesson.reviewStatus).toBe("needs-review");
    expect(lesson.reuse).toMatchObject({
      cacheScope: "shared",
      evidenceSnapshotId: source.reuse.evidenceSnapshotId,
      generatedAt: source.reuse.generatedAt,
      intentSignature: source.reuse.intentSignature,
      lastUserConfirmationAt: NOW.toISOString(),
      modelVersion: source.reuse.modelVersion,
      policyVersion: source.reuse.policyVersion,
      promptVersion: source.reuse.promptVersion,
      reuseCount: 0,
    });
    expect(lesson.claims).toEqual(source.claims);
    expect(audit).toMatchObject({
      by: "learner-share",
      from: "generated",
      lessonId: COPY_ID,
      reason: `Shared by a learner from lesson ${source.lessonId} v1`,
      to: "needs-review",
    });
  });

  it("strips the learner's assumptions and any contact details in the text", async () => {
    const { lesson } = await shareLesson(personal(), { id: () => COPY_ID, now: NOW });

    expect(lesson.assumptions).toEqual([]);
    expect(lesson.summary).toBe(
      "Ask Ada at [email removed] or call [number removed] about kettles boiled in 2026-11.",
    );
    expect(lesson.reuse.contentHash).not.toBe(personal().reuse.contentHash);
  });

  it("refuses lessons already shared, rejected, or never checked", async () => {
    await expect(
      shareLesson({ ...personal(), reuse: { ...personal().reuse, cacheScope: "shared" } }),
    ).rejects.toThrow(NotShareableError);
    await expect(shareLesson({ ...personal(), reviewStatus: "rejected" })).rejects.toThrow(
      NotShareableError,
    );
    await expect(shareLesson({ ...personal(), reviewStatus: "generated" })).rejects.toThrow(
      NotShareableError,
    );
  });
});

describe("redactContact", () => {
  it.each([
    ["555-123-4567", "[number removed]"],
    ["(555) 123-4567", "[number removed]"],
    ["555.123.4567", "[number removed]"],
    ["020 7946 0958", "[number removed]"],
    ["612-345-678", "[number removed]"],
    ["josé@ejemplo.es", "[email removed]"],
    ["muñoz.a@correo.com.mx", "[email removed]"],
  ])("removes %s", (input, output) => {
    expect(redactContact(`Call ${input} today`)).toBe(`Call ${output} today`);
  });

  it("leaves dates, years and quantities alone", () => {
    const text = "Boils at 100 °C; 1,500 W; 2026-11-03; 3 500 mL; steps 100 200 300; 1.5-2.0 kg";
    expect(redactContact(text)).toBe(text);
  });
});
