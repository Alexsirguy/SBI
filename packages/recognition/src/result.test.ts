import { RecognitionResult } from "@sbi/contracts";
import { describe, expect, it } from "vitest";
import type { FallbackOutcome } from "./fallback";
import type { RankedRecognition } from "./ranking";
import {
  buildRecognitionResult,
  parseRecognitionRetention,
  sha256Hex,
  withSelection,
} from "./result";

const SESSION = "0192f1a0-0000-7000-8000-0000000000aa";
const now = new Date("2026-10-28T12:00:00.000Z");
const bytes = new TextEncoder().encode("photo bytes");

const outcome: FallbackOutcome = {
  status: "recognised",
  candidates: [],
  observations: ["two wheels"],
  provider: "openai-mini",
  model: "gpt-5.4-mini-2026-08-01",
  promptVersion: "recognition-p0.1",
  latencyMs: 10,
  usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
  fallbackFrom: ["meta-spark"],
};

const ranked: RankedRecognition = {
  calibrationVersion: "uncalibrated-v0",
  unmapped: [],
  candidates: [
    {
      taxonomyId: "object.bicycle",
      label: "Bicycle",
      certainty: "likely",
      calibratedConfidence: 0.9,
      reasons: ["two wheels"],
    },
  ],
};

describe("sha256Hex", () => {
  it("hashes bytes to lowercase hex", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("buildRecognitionResult", () => {
  it("builds a valid result that stores the image only as a hash", async () => {
    const result = await buildRecognitionResult({
      image: bytes,
      now,
      outcome,
      ranked,
      retention: { resultTtlDays: 30 },
      sessionId: SESSION,
    });

    expect(RecognitionResult.parse(result)).toEqual(result);
    expect(result.imageSha256).toBe(await sha256Hex(bytes));
    expect(JSON.stringify(result)).not.toContain(Buffer.from(bytes).toString("base64"));
    expect(Object.keys(result)).not.toContain("image");
  });

  it("records provider, model version, prompt and calibration apart from any lesson", async () => {
    const result = await buildRecognitionResult({
      image: bytes,
      now,
      outcome,
      ranked,
      retention: { resultTtlDays: 30 },
      sessionId: SESSION,
    });

    expect(result).toMatchObject({
      provider: "openai-mini",
      model: "gpt-5.4-mini-2026-08-01",
      modelVersion: "gpt-5.4-mini-2026-08-01+recognition-p0.1",
      calibrationVersion: "uncalibrated-v0",
      candidates: ranked.candidates,
      observations: ["two wheels"],
    });
  });

  it("sets a deletion deadline from the retention policy", async () => {
    const result = await buildRecognitionResult({
      image: bytes,
      now,
      outcome,
      ranked,
      retention: { resultTtlDays: 30 },
      sessionId: SESSION,
    });

    expect(result.createdAt).toBe("2026-10-28T12:00:00.000Z");
    expect(result.deleteBy).toBe("2026-11-27T12:00:00.000Z");
  });
});

describe("withSelection", () => {
  async function result() {
    return buildRecognitionResult({
      image: bytes,
      now,
      outcome,
      ranked,
      retention: { resultTtlDays: 30 },
      sessionId: SESSION,
    });
  }

  it("records a confirmed candidate", async () => {
    expect(withSelection(await result(), { taxonomyId: "object.bicycle" })).toMatchObject({
      selectedTaxonomyId: "object.bicycle",
    });
  });

  it("records a correction to another object", async () => {
    const corrected = withSelection(await result(), {
      taxonomyId: "object.swing",
      correction: { kind: "selected-alternative", taxonomyId: "object.swing" },
    });

    expect(RecognitionResult.parse(corrected)).toMatchObject({
      selectedTaxonomyId: "object.swing",
      userCorrection: { kind: "selected-alternative", taxonomyId: "object.swing" },
    });
  });

  it("records free text without a selected category", async () => {
    const corrected = withSelection(await result(), {
      correction: { kind: "free-text", text: "a penny-farthing" },
    });

    expect(corrected.selectedTaxonomyId).toBeUndefined();
    expect(corrected.userCorrection).toEqual({ kind: "free-text", text: "a penny-farthing" });
  });

  it("refuses to select an object that is neither a candidate nor a correction", async () => {
    const unselected = await result();
    expect(() => withSelection(unselected, { taxonomyId: "object.swing" })).toThrow();
  });
});

describe("parseRecognitionRetention", () => {
  it("defaults to 30 days and caps at 90", () => {
    expect(parseRecognitionRetention({})).toEqual({ resultTtlDays: 30 });
    expect(parseRecognitionRetention({ RECOGNITION_RESULT_TTL_DAYS: "7" })).toEqual({
      resultTtlDays: 7,
    });
    expect(() => parseRecognitionRetention({ RECOGNITION_RESULT_TTL_DAYS: "365" })).toThrow();
  });
});
