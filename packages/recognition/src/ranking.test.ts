import { describe, expect, it } from "vitest";
import {
  DEFAULT_RANKING_CONFIG,
  gateLesson,
  parseRankingConfig,
  rankCandidates,
  type LabelResolver,
  type RankingConfig,
} from "./ranking";
import type { RecognitionOutput } from "./vision-llm-recogniser";
import type { z } from "zod";

type Output = z.infer<typeof RecognitionOutput>;

const ENTRIES: Record<string, { id: string; label: string; part?: string }[]> = {
  bicycle: [{ id: "object.bicycle", label: "Bicycle" }],
  bike: [{ id: "object.bicycle", label: "Bicycle" }],
  "bicycle chain": [{ id: "object.bicycle", label: "Bicycle", part: "Chain" }],
  "electric kettle": [{ id: "object.electric-kettle", label: "Electric kettle" }],
  teapot: [{ id: "object.teapot", label: "Teapot" }],
  lens: [
    { id: "object.magnifying-glass", label: "Magnifying glass", part: "Lens" },
    { id: "object.eyeglasses", label: "Eyeglasses", part: "Lens" },
  ],
};

const resolver: LabelResolver = {
  resolve: (label) =>
    (ENTRIES[label.toLowerCase()] ?? []).map(({ id, label: name, part }) => ({
      entry: { id, label: name },
      ...(part ? { part: { label: part } } : {}),
    })),
};

function output(
  candidates: Output["candidates"],
  status: Output["status"] = "recognised",
  observations: string[] = [],
): Output {
  return { candidates, observations, status };
}

const candidate = (
  label: string,
  calibratedConfidence: number,
  certainty: "likely" | "possible" | "unsure" = "likely",
  reasons: string[] = [`looks like a ${label}`],
) => ({ calibratedConfidence, certainty, label, reasons });

describe("rankCandidates", () => {
  it("maps labels to taxonomy ids and sorts by confidence", () => {
    const ranked = rankCandidates(
      output([candidate("teapot", 0.3, "unsure"), candidate("electric kettle", 0.85)]),
      resolver,
    );

    expect(ranked.candidates.map((c) => c.taxonomyId)).toEqual([
      "object.electric-kettle",
      "object.teapot",
    ]);
    expect(ranked.candidates[0]).toMatchObject({ label: "Electric kettle", certainty: "likely" });
  });

  it("bands calibrated confidence instead of exposing raw scores", () => {
    const ranked = rankCandidates(
      output([
        candidate("bicycle", 0.95),
        candidate("teapot", 0.6),
        candidate("electric kettle", 0.2),
      ]),
      resolver,
    );

    expect(ranked.candidates.map((c) => c.certainty)).toEqual(["likely", "possible", "unsure"]);
  });

  it("never rates a candidate above the model's own certainty", () => {
    const ranked = rankCandidates(output([candidate("bicycle", 0.95, "unsure")]), resolver);

    expect(ranked.candidates[0]?.certainty).toBe("unsure");
  });

  it("caps an ambiguous photo at possible", () => {
    const ranked = rankCandidates(output([candidate("bicycle", 0.95)], "ambiguous"), resolver);

    expect(ranked.candidates[0]?.certainty).toBe("possible");
  });

  it("attaches at least one reason to every candidate", () => {
    const ranked = rankCandidates(
      output([candidate("bicycle", 0.9, "likely", [])], "recognised", ["two wheels and a chain"]),
      resolver,
    );

    expect(ranked.candidates[0]?.reasons).toEqual(["two wheels and a chain"]);

    const bare = rankCandidates(output([candidate("bike", 0.9, "likely", [])]), resolver);
    expect(bare.candidates[0]?.reasons).toEqual(["The photo matches what a bicycle looks like."]);
  });

  it("merges labels that name the same object, keeping the strongest", () => {
    const ranked = rankCandidates(
      output([
        candidate("bike", 0.7, "possible", ["has pedals"]),
        candidate("bicycle", 0.9, "likely", ["two wheels"]),
      ]),
      resolver,
    );

    expect(ranked.candidates).toHaveLength(1);
    expect(ranked.candidates[0]).toMatchObject({ calibratedConfidence: 0.9, certainty: "likely" });
    expect(ranked.candidates[0]?.reasons).toEqual(["two wheels", "has pedals"]);
  });

  it("names the part when the model saw only a part", () => {
    const ranked = rankCandidates(
      output([candidate("bicycle chain", 0.8, "likely", [])]),
      resolver,
    );

    expect(ranked.candidates[0]).toMatchObject({ taxonomyId: "object.bicycle" });
    expect(ranked.candidates[0]?.reasons).toEqual(["Shows the chain of a bicycle."]);
  });

  it("lowers certainty when a label could be several objects", () => {
    const ranked = rankCandidates(output([candidate("lens", 0.9)]), resolver);

    expect(ranked.candidates.map((c) => [c.taxonomyId, c.certainty])).toEqual([
      ["object.eyeglasses", "possible"],
      ["object.magnifying-glass", "possible"],
    ]);
  });

  it("reports labels the taxonomy does not know, for catalog gaps", () => {
    const ranked = rankCandidates(
      output([candidate("spaceship", 0.9), candidate("bicycle", 0.4, "possible")]),
      resolver,
    );

    expect(ranked.unmapped).toEqual(["spaceship"]);
    expect(ranked.candidates.map((c) => c.taxonomyId)).toEqual(["object.bicycle"]);
  });

  it("applies the calibration table and records its version", () => {
    const config: RankingConfig = {
      ...DEFAULT_RANKING_CONFIG,
      calibration: { version: "halved-v1", map: (score) => score / 2 },
    };
    const ranked = rankCandidates(output([candidate("bicycle", 0.9)]), resolver, config);

    expect(ranked.calibrationVersion).toBe("halved-v1");
    expect(ranked.candidates[0]).toMatchObject({ calibratedConfidence: 0.45, certainty: "unsure" });
  });

  it("keeps at most three candidates", () => {
    const ranked = rankCandidates(
      output([
        candidate("bicycle", 0.9),
        candidate("teapot", 0.5),
        candidate("electric kettle", 0.4),
        candidate("lens", 0.3),
      ]),
      resolver,
    );

    expect(ranked.candidates).toHaveLength(3);
  });
});

describe("gateLesson", () => {
  const rank = (...candidates: ReturnType<typeof candidate>[]) =>
    rankCandidates(output(candidates), resolver);

  it("lets a clear, likely top candidate start a lesson", () => {
    expect(
      gateLesson(rank(candidate("bicycle", 0.92), candidate("teapot", 0.2, "unsure"))),
    ).toEqual({
      status: "ready",
      candidate: expect.objectContaining({ taxonomyId: "object.bicycle" }),
    });
  });

  it("asks the learner when the top candidate is not likely", () => {
    expect(gateLesson(rank(candidate("bicycle", 0.6, "possible")))).toEqual({
      status: "needs-confirmation",
      reason: "low-certainty",
    });
  });

  it("asks the learner when the runner-up is close", () => {
    expect(gateLesson(rank(candidate("bicycle", 0.85), candidate("teapot", 0.8)))).toEqual({
      status: "needs-confirmation",
      reason: "close-alternatives",
    });
  });

  it("asks the learner when nothing was recognised", () => {
    expect(gateLesson(rank())).toEqual({ status: "needs-confirmation", reason: "no-candidates" });
  });

  it("follows the configured thresholds", () => {
    const lenient: RankingConfig = {
      ...DEFAULT_RANKING_CONFIG,
      lessonGate: { minCertainty: "possible", minMargin: 0 },
    };
    expect(gateLesson(rank(candidate("bicycle", 0.6, "possible")), lenient).status).toBe("ready");
  });

  it("rejects thresholds that are out of order", () => {
    expect(() =>
      rankCandidates(output([]), resolver, {
        ...DEFAULT_RANKING_CONFIG,
        bands: { likely: 0.4, possible: 0.6 },
      }),
    ).toThrow(/likely/);
  });
});

describe("parseRankingConfig", () => {
  it("reads thresholds from the environment", () => {
    const config = parseRankingConfig({
      RECOGNITION_BAND_LIKELY: "0.9",
      RECOGNITION_BAND_POSSIBLE: "0.6",
      RECOGNITION_LESSON_MIN_CERTAINTY: "possible",
      RECOGNITION_LESSON_MIN_MARGIN: "0.1",
    });

    expect(config.bands).toEqual({ likely: 0.9, possible: 0.6 });
    expect(config.lessonGate).toEqual({ minCertainty: "possible", minMargin: 0.1 });
  });

  it("refuses out-of-range or unordered thresholds", () => {
    expect(() => parseRankingConfig({ RECOGNITION_BAND_LIKELY: "1.5" })).toThrow();
    expect(() => parseRankingConfig({ RECOGNITION_BAND_POSSIBLE: "0.9" })).toThrow(/likely/);
    expect(() => parseRankingConfig({ RECOGNITION_LESSON_MIN_CERTAINTY: "certain" })).toThrow();
  });
});
