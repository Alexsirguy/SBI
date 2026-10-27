import { join } from "node:path";
import { describeContract } from "@sbi/testing";
import { describe, expect, it } from "vitest";
import { Claim, EvidenceSource } from "./evidence";

const fixtures = join(import.meta.dirname, "fixtures");

describeContract("EvidenceSource", EvidenceSource, join(fixtures, "evidence-source"));
describeContract("Claim", Claim, join(fixtures, "claim"));

describe("Claim defaults", () => {
  it("defaults dependsOn to an empty list", () => {
    const claim = Claim.parse({
      claimId: "c1",
      text: "Heat flows from hotter to cooler regions.",
      status: "supported",
      sourceIds: ["s1"],
      scope: "general",
      confidence: "high",
    });

    expect(claim.dependsOn).toEqual([]);
  });
});
