import { join } from "node:path";
import { describeContract } from "@sbi/testing";
import { describe, expect, it } from "vitest";
import { Claim, EvidenceInvalidated, EvidenceSource } from "./evidence";

const fixtures = join(import.meta.dirname, "fixtures");

describeContract("EvidenceSource", EvidenceSource, join(fixtures, "evidence-source"));
describeContract("Claim", Claim, join(fixtures, "claim"));
describeContract(
  "EvidenceInvalidated",
  EvidenceInvalidated,
  join(fixtures, "evidence-invalidated"),
);

describe("Claim defaults", () => {
  it("defaults dependsOn to an empty list", () => {
    const claim = Claim.parse({
      claimId: "0192f1a0-0000-7000-8000-000000000005",
      text: "Heat flows from hotter to cooler regions.",
      status: "supported",
      sourceIds: ["0192f1a0-0000-7000-8000-000000000001"],
      scope: "general",
      confidence: "high",
    });

    expect(claim.dependsOn).toEqual([]);
  });
});
