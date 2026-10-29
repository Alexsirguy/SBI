import { createTaxonomy, SEED_TAXONOMY } from "@sbi/taxonomy";
import { describe, expect, it } from "vitest";
import { answerClarification, NOT_SURE, planClarification, type ClarifyTaxonomy } from "./clarify";
import { DEFAULT_RANKING_CONFIG, type RankedRecognition } from "./ranking";

const TREE: Record<string, { label: string; parent?: string; concepts: string[] }> = {
  "category.heating": { label: "Heating and cooking", concepts: ["heat"] },
  "category.optics": { label: "Light and lenses", concepts: ["light"] },
  "object.teapot": { label: "Teapot", parent: "category.heating", concepts: ["insulation"] },
  "object.coffee-pot": {
    label: "Coffee pot",
    parent: "category.heating",
    concepts: ["dissolving"],
  },
  "object.mug": { label: "Mug", parent: "category.heating", concepts: [] },
  "object.cup": { label: "Cup", parent: "category.heating", concepts: [] },
  "object.glass-of-water": { label: "Glass of water", parent: "category.optics", concepts: [] },
  "object.screen": { label: "Phone screen", concepts: ["pixels"] },
  "object.salt-crystals": { label: "Salt crystals", concepts: [] },
};

const taxonomy: ClarifyTaxonomy = {
  ancestors(id) {
    const chain = [];
    for (let at = TREE[id]?.parent; at; at = TREE[at]?.parent) {
      chain.push({ id: at, label: TREE[at]?.label ?? at });
    }
    return chain;
  },
  concepts(id) {
    const own = TREE[id]?.concepts ?? [];
    return [...own, ...this.ancestors(id).flatMap((entry) => TREE[entry.id]?.concepts ?? [])];
  },
};

function ranked(...candidates: [string, number, "likely" | "possible" | "unsure"][]) {
  return {
    calibrationVersion: "v0",
    unmapped: [],
    candidates: candidates.map(([taxonomyId, calibratedConfidence, certainty]) => ({
      taxonomyId,
      label: TREE[taxonomyId]?.label ?? taxonomyId,
      calibratedConfidence,
      certainty,
      reasons: ["seen"],
    })),
  } satisfies RankedRecognition;
}

describe("planClarification", () => {
  it("proceeds when the gate is clear", () => {
    const plan = planClarification(ranked(["object.teapot", 0.95, "likely"]), taxonomy);

    expect(plan).toMatchObject({ kind: "proceed", candidate: { taxonomyId: "object.teapot" } });
  });

  it("asks a targeted question when the contenders would get different lessons", () => {
    const plan = planClarification(
      ranked(["object.glass-of-water", 0.6, "possible"], ["object.screen", 0.55, "possible"]),
      taxonomy,
    );

    expect(plan).toMatchObject({
      kind: "ask",
      question: "Is it a glass of water or a phone screen?",
      options: [
        { taxonomyId: "object.glass-of-water", label: "Glass of water" },
        { taxonomyId: "object.screen", label: "Phone screen" },
      ],
    });
  });

  it("asks about a single unsure candidate instead of assuming it", () => {
    const plan = planClarification(ranked(["object.teapot", 0.55, "possible"]), taxonomy);

    expect(plan).toMatchObject({
      kind: "ask",
      question: "Is it a teapot?",
      options: [{ taxonomyId: "object.teapot" }],
    });
  });

  it("skips the question and states the assumption when the lesson would be the same", () => {
    const plan = planClarification(
      ranked(["object.mug", 0.7, "possible"], ["object.cup", 0.68, "possible"]),
      taxonomy,
    );

    expect(plan).toEqual({
      kind: "assume-category",
      fallback: {
        taxonomyId: "category.heating",
        label: "Heating and cooking",
        alternatives: ["Mug", "Cup"],
        assumption:
          "We could not tell if this is a mug or a cup, so this lesson covers heating and cooking, which is true of both.",
      },
    });
  });

  it("offers a category fallback for the question when the contenders share one", () => {
    const plan = planClarification(
      ranked(["object.teapot", 0.7, "possible"], ["object.coffee-pot", 0.68, "possible"]),
      taxonomy,
    );

    expect(plan).toMatchObject({
      kind: "ask",
      fallback: { taxonomyId: "category.heating" },
    });
  });

  it("offers no fallback when the contenders share no category", () => {
    const plan = planClarification(
      ranked(["object.teapot", 0.6, "possible"], ["object.glass-of-water", 0.58, "possible"]),
      taxonomy,
    );

    expect(plan).toMatchObject({ kind: "ask" });
    expect(plan.kind === "ask" && plan.fallback).toBeUndefined();
  });

  it("asks the learner to describe the object when nothing was recognised", () => {
    expect(planClarification(ranked(), taxonomy)).toEqual({ kind: "describe" });
  });

  it("never marks an assumed or clarified result as likely", () => {
    const plans = [
      planClarification(
        ranked(["object.mug", 0.7, "possible"], ["object.cup", 0.68, "possible"]),
        taxonomy,
      ),
      planClarification(ranked(["object.teapot", 0.55, "possible"]), taxonomy),
    ];
    expect(JSON.stringify(plans)).not.toContain('"likely"');
  });

  it("leaves out weak candidates far behind the leader", () => {
    const plan = planClarification(
      ranked(["object.glass-of-water", 0.6, "possible"], ["object.screen", 0.1, "unsure"]),
      taxonomy,
      DEFAULT_RANKING_CONFIG,
    );

    expect(plan).toMatchObject({ kind: "ask", question: "Is it a glass of water?" });
  });
});

describe("answerClarification", () => {
  const ask = planClarification(
    ranked(["object.teapot", 0.7, "possible"], ["object.coffee-pot", 0.68, "possible"]),
    taxonomy,
  );

  it("records the learner's choice as a correction", () => {
    expect(answerClarification(ask, "object.coffee-pot")).toEqual({
      kind: "confirmed",
      taxonomyId: "object.coffee-pot",
      correction: { kind: "selected-alternative", taxonomyId: "object.coffee-pot" },
    });
  });

  it("falls back to the shared category when the learner is not sure", () => {
    expect(answerClarification(ask, NOT_SURE)).toMatchObject({
      kind: "assume-category",
      fallback: { taxonomyId: "category.heating" },
    });
  });

  it("asks for a description when there is no safe fallback", () => {
    const single = planClarification(ranked(["object.screen", 0.55, "possible"]), taxonomy);

    expect(answerClarification(single, NOT_SURE)).toEqual({ kind: "describe" });
  });

  it("rejects answers that were not offered", () => {
    expect(() => answerClarification(ask, "object.screen")).toThrow(/not offered/);
  });
});

describe("with the seed taxonomy", () => {
  const seed = createTaxonomy(SEED_TAXONOMY);

  it("falls back to the shared category for a teapot or coffee pot", () => {
    const plan = planClarification(
      ranked(["object.teapot", 0.7, "possible"], ["object.coffee-pot", 0.65, "possible"]),
      seed,
    );

    expect(plan).toMatchObject({
      kind: "ask",
      question: "Is it a teapot or a coffee pot?",
      fallback: { taxonomyId: "category.heating", label: "Heating and cooking" },
    });
  });

  it("asks glass of water or salt crystals without a fallback across domains", () => {
    const plan = planClarification(
      ranked(
        ["object.glass-of-water", 0.6, "possible"],
        ["object.salt-crystals", 0.55, "possible"],
      ),
      seed,
    );

    expect(plan).toMatchObject({
      kind: "ask",
      question: "Is it a glass of water or salt crystals?",
    });
  });
});
