import type { Certainty } from "@sbi/contracts";
import { describe, expect, it } from "vitest";
import { modelLabels } from "./result";

const candidate = (
  label: string,
  calibratedConfidence: number,
  certainty: Certainty = "possible",
) => ({
  label,
  certainty,
  calibratedConfidence,
  reasons: [],
});

describe("modelLabels", () => {
  it("keeps the model's own names, strongest first, without repeats", () => {
    expect(
      modelLabels({
        status: "recognised",
        candidates: [
          candidate("teapot", 0.4),
          candidate("  stovetop   kettle ", 0.8, "likely"),
          candidate("Teapot", 0.3),
        ],
      }),
    ).toEqual([
      { label: "Stovetop kettle", certainty: "likely" },
      { label: "Teapot", certainty: "possible" },
    ]);
  });

  it("never calls an ambiguous photo likely, and offers nothing for unsupported ones", () => {
    expect(
      modelLabels({ status: "ambiguous", candidates: [candidate("kettle", 0.9, "likely")] }),
    ).toEqual([{ label: "Kettle", certainty: "possible" }]);
    expect(modelLabels({ status: "unsupported", candidates: [] })).toEqual([]);
  });
});
