import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { loadSeedSet } from "../seed-set";
import type { FetchedSource, Retriever } from "@sbi/evidence";
import {
  EvidenceFixture,
  runEvidenceSpike,
  supportingExcerpt,
  trustedSourceFinder,
} from "./evidence";
import {
  CacheFixture,
  evaluateCache,
  intentSignature,
  keywordClassifier,
  keywordIntent,
} from "./intent-cache";
import { auditRights } from "./rights";
import { evaluateRules } from "./safety-rules";

const spikesDir = join(import.meta.dirname, "../../../../docs/research/spikes");
const readJson = (file: string) => JSON.parse(readFileSync(join(spikesDir, file), "utf8"));
const set = loadSeedSet();

describe("intent-signature cache", () => {
  const fixture = CacheFixture.parse(readJson("cache-pairs.json"));
  const intents = [
    { id: "gearing", keywords: ["gears", "hill"] },
    { id: "balance", keywords: ["fall", "balance"] },
  ];

  it("picks the best-scoring intent and refuses ties or no match", () => {
    expect(keywordIntent("Why do gears help on a hill?", intents)).toBe("gearing");
    expect(keywordIntent("Do gears help balance?", intents)).toBeNull();
    expect(keywordIntent("What colour is it?", intents)).toBeNull();
  });

  it("separates audiences in the signature", () => {
    expect(intentSignature("object.leaf", "mass", "child")).not.toBe(
      intentSignature("object.leaf", "mass", "adult"),
    );
    expect(intentSignature("object.leaf", "mass", "teen")).toBe(
      intentSignature("object.leaf", "mass", "teen"),
    );
  });

  it("never reuses a lesson for a different intent on the fixture pairs", async () => {
    const result = await evaluateCache(fixture, keywordClassifier(fixture.catalog));
    expect(result.falsePositive).toBe(0);
    expect(result.recall).toBeGreaterThanOrEqual(0.75);
  });
});

describe("safety rules baseline", () => {
  it("catches every high-risk seed prompt without blocking benign ones", () => {
    const result = evaluateRules(set.prompts);
    expect(result.riskyCaught).toBe(result.risky);
    expect(result.benignBlocked).toBe(0);
  });
});

describe("evidence spike", () => {
  const article =
    "Starley came out with the first commercially successful safety bicycle he named the Rover in 1885. It was chain driven.";

  it("finds the supporting sentence only when every term is present", () => {
    expect(supportingExcerpt(article, ["Rover", "1885"])).toContain("Rover");
    expect(supportingExcerpt(article, ["Rover", "1925"])).toBeNull();
  });

  it("produces contract-valid records for supported and unsupported claims", async () => {
    const fixture = EvidenceFixture.parse({
      topics: [
        {
          topic: "bicycle",
          claims: [
            {
              claimId: "c1",
              text: "The Rover came out in 1885.",
              source: "Safety bicycle",
              terms: ["Rover", "1885"],
            },
            {
              claimId: "c2",
              text: "The Rover came out in 1925.",
              source: "Safety bicycle",
              terms: ["1925"],
            },
          ],
        },
      ],
    });
    const source: FetchedSource = {
      title: "Safety bicycles",
      publisher: "NASA",
      authors: [],
      url: "https://www.nasa.gov/bikes",
      sourceType: "institution",
      passages: [{ location: "paragraph 1", text: article }],
      rightsStatus: "reusable",
      retrieval: {
        connector: "us-gov",
        fetchedAt: "2026-10-27T12:00:00.000Z",
        access: "full-text",
        contentSha256: "a".repeat(64),
      },
    };
    const results = await runEvidenceSpike(fixture, async () => [source]);
    expect(results.map((result) => [result.supported, result.contractValid])).toEqual([
      [true, true],
      [false, true],
    ]);
    expect(results[0]).toMatchObject({ sourceTitle: "Safety bicycles", connector: "us-gov" });
  });

  it("reaches sources through Wikipedia references only, once per article", async () => {
    const discover = vi.fn(async () => ({ fetched: [], failed: [] }));
    const retriever: Retriever = { discover, retrieve: vi.fn() };
    const find = trustedSourceFinder(retriever);
    await find("Safety bicycle");
    await find("Safety bicycle");
    expect(discover).toHaveBeenCalledTimes(1);
    expect(retriever.retrieve).not.toHaveBeenCalled();
  });

  it("covers at least three topics", () => {
    expect(
      EvidenceFixture.parse(readJson("evidence-claims.json")).topics.length,
    ).toBeGreaterThanOrEqual(3);
  });
});

describe("rights audit", () => {
  it("finds a complete rights record for every seed image", () => {
    const result = auditRights(set);
    expect(result.complete).toBe(result.images);
    expect(result.publishable + result.internalOnly.length).toBe(result.images);
  });
});
