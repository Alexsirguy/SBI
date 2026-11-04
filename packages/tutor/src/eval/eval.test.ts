import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifierSaying, reply, scriptedProvider } from "../test-lesson";
import { loadEvalSet } from "./dataset";
import { runTutorEval } from "./run";
import { looksSpanish, summarise, type EvalRecord } from "./score";

const SET = loadEvalSet(join(import.meta.dirname, "../../../../docs/research/tutor-eval"));

describe("the held-out set", () => {
  it("has 60 cases over every expectation, each naming claims its lesson really has", () => {
    expect(SET.cases).toHaveLength(60);
    const kinds = new Set(SET.cases.map((item) => item.expect));
    expect([...kinds].sort()).toEqual(["age", "ambiguous", "beyond", "grounded", "harm"]);
    for (const item of SET.cases) {
      const lesson = SET.lessons[item.lesson]?.lesson;
      const ids = lesson?.claims.map((claim) => claim.claimId) ?? [];
      expect(
        item.claims.every((id) => ids.includes(id)),
        item.id,
      ).toBe(true);
      if (item.expect === "grounded") expect(item.claims.length, item.id).toBeGreaterThan(0);
      if (item.show) expect(SET.lessons[item.lesson]?.manifest, item.id).toBeDefined();
    }
    expect(SET.cases.filter((item) => item.locale === "es").length).toBeGreaterThan(0);
  });
});

const record = (overrides: Partial<EvalRecord> & Pick<EvalRecord, "expect">): EvalRecord => ({
  caseId: "c",
  locale: "en",
  show: false,
  expectedClaims: ["0192f1a0-0000-7000-8000-0000000c0001"],
  ...overrides,
});

const turn = (
  kind: string,
  text = "Short answer.",
  cited: string[] = [],
  policy?: "harm" | "age",
) =>
  ({
    response: {
      kind,
      text,
      citedClaimIds: cited,
      ...(policy ? { policy: { reason: policy } } : {}),
    },
  }) as unknown as EvalRecord["turn"];

describe("summarise", () => {
  it("scores each metric against its threshold and passes only when all do", () => {
    const claim = "0192f1a0-0000-7000-8000-0000000c0001";
    const good = summarise([
      record({
        expect: "grounded",
        turn: turn("lesson", "It heats.", [claim]),
        entailment: "supports",
      }),
      record({ expect: "beyond", turn: turn("beyond-lesson", "Yes, it does.") }),
      record({ expect: "harm", turn: turn("policy", "No.", [], "harm") }),
      record({ expect: "age", turn: turn("policy", "Later.", [], "age") }),
      record({
        expect: "beyond",
        locale: "es",
        turn: turn("beyond-lesson", "Sí, porque el agua se calienta más con la potencia."),
      }),
    ]);
    expect(good.metrics).toMatchObject({
      groundedness: 1,
      citationCorrectness: 1,
      harmRefusal: 1,
      overRefusal: 0,
      spanishReplies: 1,
    });
    expect(good.pass).toBe(true);

    const bad = summarise([
      record({ expect: "grounded", turn: turn("policy", "No.", [], "harm") }),
      record({ expect: "harm", turn: turn("beyond-lesson", "Here is how.") }),
      record({ expect: "beyond", error: "timeout" }),
    ]);
    expect(bad.metrics.overRefusal).toBe(1);
    expect(bad.metrics.harmRefusal).toBe(0);
    expect(bad.errors).toBe(1);
    expect(bad.pass).toBe(false);
  });

  it("measures length as the median reply in words", () => {
    const summary = summarise(
      ["One two.", "One two three four.", "One two three four five six."].map((text) =>
        record({ expect: "beyond", turn: turn("beyond-lesson", text) }),
      ),
    );
    expect(summary.metrics.medianWords).toBe(4);
  });

  it("tells Spanish from English replies", () => {
    expect(looksSpanish("La luz se dobla porque el vidrio es más denso.")).toBe(true);
    expect(looksSpanish("Light bends because the glass is denser.")).toBe(false);
  });
});

describe("runTutorEval", () => {
  it("runs each case through the pipeline and judges only cited replies", async () => {
    const cases = SET.cases.filter((item) => item.lesson === "kettle").slice(0, 2);
    const kettle = SET.lessons.kettle?.lesson;
    const first = kettle?.claims[0]?.claimId ?? "";
    const { provider } = scriptedProvider([reply("It heats.", ["f1"]), reply("It is slow.", [])]);
    const judged: string[] = [];
    const records = await runTutorEval(
      {
        provider,
        classify: classifierSaying(),
        concurrency: 1,
        judge: async (text) => {
          judged.push(text);
          return "supports";
        },
      },
      { ...SET, cases },
    );
    expect(records.map((item) => item.turn?.response.kind)).toEqual(["lesson", "beyond-lesson"]);
    expect(records[0]?.turn?.response.citedClaimIds).toHaveLength(1);
    expect(first).not.toBe("");
    expect(judged).toEqual(["It heats."]);
  });
});
