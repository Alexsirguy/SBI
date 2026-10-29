import { Claim, type Claim as ClaimRecord } from "@sbi/contracts";
import type { LlmProvider } from "@sbi/llm";
import { describe, expect, it, vi } from "vitest";
import { createMemoryEvidenceRepositories } from "../memory";
import type { FetchedSource } from "../retrieval/types";
import { buildClaims, type ClaimDraft } from "./builder";
import { ClaimGraphError, collectDependents, createClaimGraph } from "./graph";
import { createLlmSupportJudge, type SupportJudge, type SupportVerdict } from "./judge";
import { saveClaimGraph } from "./persist";
import { claimTerms, matchTerms } from "./terms";

function fetched(url: string, passages: string[]): FetchedSource {
  return {
    title: `Source at ${url}`,
    publisher: "U.S. Geological Survey",
    authors: [],
    url,
    sourceType: "institution",
    passages: passages.map((text, index) => ({ location: `paragraph ${index + 1}`, text })),
    rightsStatus: "reusable",
    retrieval: {
      connector: "us-gov",
      fetchedAt: "2026-10-29T09:00:00.000Z",
      access: "full-text",
      contentSha256: "b".repeat(64),
    },
  };
}

const USGS = fetched("https://www.usgs.gov/water-density", [
  "Water is densest at 4.0 °C, where its density is 0.9998395 g/ml.",
  "Ice is less dense than liquid water, which is why ice floats.",
  "Water boils at 100 °C at sea level.",
]);
const NIST = fetched("https://www.nist.gov/water", [
  "At sea level, pure water boils at 100 °C.",
  "Ice floats because it is less dense than liquid water.",
]);

// Answers from a lookup of passage → verdict; anything unlisted is "insufficient".
function scriptedJudge(verdicts: Record<string, SupportVerdict["verdict"]>): SupportJudge {
  return {
    version: "scripted",
    judge: vi.fn(async ({ excerpt }) => ({
      verdict: verdicts[excerpt] ?? "insufficient",
      reason: "scripted",
    })),
  };
}

const supportsAll: SupportJudge = {
  version: "always",
  judge: async () => ({ verdict: "supports", reason: "ok" }),
};

describe("claimTerms and matchTerms", () => {
  it("requires figures and names to appear in the passage", () => {
    const profile = claimTerms("Near Mount Everest, water boils at roughly 70 °C.");
    expect(profile.numbers).toEqual(["70"]);
    expect(profile.names).toEqual(["mount everest"]);
    expect(matchTerms(profile, "On Mount Everest water boils at about 71 °C.").passes).toBe(false);
    expect(matchTerms(profile, "On Mount Everest water boils at 70 °C.").passes).toBe(true);
  });

  it("compares figures by value", () => {
    const profile = claimTerms("Pure water is densest at 4 °C.");
    expect(matchTerms(profile, "Water's density peaks at 4.0° Celsius.").passes).toBe(true);
    expect(matchTerms(profile, "Water's density peaks at 40° Celsius.").passes).toBe(false);
  });

  it("treats thousands separators and plurals alike", () => {
    const profile = claimTerms("Vaporising water takes about 2,257 kilojoules per kilogram.");
    expect(matchTerms(profile, "Vaporising water takes 2257 kilojoules per kilogram.").passes).toBe(
      true,
    );
    expect(matchTerms(profile, "Water is wet.").passes).toBe(false);
  });
});

describe("buildClaims", () => {
  it("supports a claim only with an excerpt the judge accepted, and cites it", async () => {
    const judge = scriptedJudge({ [USGS.passages[2]?.text ?? ""]: "supports" });
    const built = await buildClaims(
      [{ key: "boil", text: "Water boils at 100 °C at sea level.", scope: "pure water" }],
      [USGS],
      { judge },
    );

    const [claim] = built.claims;
    expect(claim).toMatchObject({ status: "supported", confidence: "medium" });
    expect(built.sources).toHaveLength(1);
    const [source] = built.sources;
    expect(source?.excerpts).toEqual([
      { excerptId: "x1", location: "paragraph 3", text: "Water boils at 100 °C at sea level." },
    ]);
    expect(claim?.citations).toEqual([{ sourceId: source?.sourceId, excerptId: "x1" }]);
    expect(source?.claimIds).toEqual([claim?.claimId]);
    expect(source?.retrieval?.connector).toBe("us-gov");
  });

  it("only asks the judge about passages that pass the term filter", async () => {
    const judge = scriptedJudge({});
    await buildClaims(
      [{ key: "boil", text: "Water boils at 100 °C at sea level.", scope: "pure water" }],
      [USGS],
      { judge },
    );
    expect(vi.mocked(judge.judge).mock.calls.map(([question]) => question.excerpt)).toEqual([
      "Water boils at 100 °C at sea level.",
    ]);
  });

  it("rates a claim backed by two sources as high confidence", async () => {
    const built = await buildClaims(
      [
        {
          key: "ice",
          text: "Ice floats because it is less dense than liquid water.",
          scope: "water",
        },
      ],
      [USGS, NIST],
      { judge: supportsAll },
    );
    expect(built.claims[0]).toMatchObject({ status: "supported", confidence: "high" });
    expect(built.claims[0]?.sourceIds).toHaveLength(2);
  });

  it("removes an unsupported claim that has no open-question wording", async () => {
    const built = await buildClaims(
      [{ key: "salt", text: "Adding salt makes pasta water boil much faster.", scope: "cooking" }],
      [USGS],
      { judge: supportsAll },
    );
    expect(built.claims).toEqual([]);
    expect(built.sources).toEqual([]);
    expect(built.removed).toEqual([
      {
        key: "salt",
        text: "Adding salt makes pasta water boil much faster.",
        reason: "no-support",
      },
    ]);
  });

  it("rewrites an unsupported claim as its open question", async () => {
    const built = await buildClaims(
      [
        {
          key: "salt",
          text: "Adding salt makes pasta water boil much faster.",
          scope: "cooking",
          openQuestion: "Does adding salt change how fast pasta water boils?",
        },
      ],
      [USGS],
      { judge: supportsAll },
    );
    expect(built.claims[0]).toMatchObject({
      text: "Does adding salt change how fast pasta water boils?",
      status: "unsupported",
      confidence: "low",
      sourceIds: [],
      uncertainty: "We have not found a trusted source for this yet.",
    });
  });

  it("removes a contradicted claim and says why", async () => {
    const judge = scriptedJudge({ [USGS.passages[2]?.text ?? ""]: "contradicts" });
    const built = await buildClaims(
      [{ key: "boil", text: "Water boils at 100 °C at sea level everywhere.", scope: "water" }],
      [USGS],
      { judge },
    );
    expect(built.removed[0]?.reason).toBe("contradicted");
  });

  it("marks a claim disputed when one source supports it and another contradicts it", async () => {
    const judge = scriptedJudge({
      [USGS.passages[2]?.text ?? ""]: "supports",
      [NIST.passages[0]?.text ?? ""]: "contradicts",
    });
    const built = await buildClaims(
      [{ key: "boil", text: "Water boils at 100 °C at sea level.", scope: "pure water" }],
      [USGS, NIST],
      { judge },
    );
    expect(built.claims[0]).toMatchObject({
      status: "disputed",
      uncertainty: "Trusted sources disagree on this.",
    });
    expect(built.claims[0]?.citations).toHaveLength(2);
  });

  it("links dependencies by id and removes unsupported steps", async () => {
    const drafts: ClaimDraft[] = [
      { key: "float", text: "Ice floats on liquid water.", scope: "water", dependsOn: ["dense"] },
      { key: "dense", text: "Ice is less dense than liquid water.", scope: "water" },
      {
        key: "lake",
        text: "Lakes freeze from the top down every single winter.",
        scope: "lakes",
        dependsOn: ["float"],
      },
      { key: "fish", text: "Fish survive under ice.", scope: "lakes", dependsOn: ["lake"] },
    ];
    const judge = scriptedJudge({
      [USGS.passages[1]?.text ?? ""]: "supports",
      [NIST.passages[1]?.text ?? ""]: "supports",
    });
    const built = await buildClaims(drafts, [USGS, NIST], { judge });

    const byKey = (key: string) => built.claims.find((claim) => claim.claimId === built.ids[key]);
    expect(byKey("dense")?.status).toBe("supported");
    expect(byKey("float")?.dependsOn).toEqual([built.ids.dense]);
    expect(built.removed.map((item) => item.key)).toEqual(["lake", "fish"]);
  });

  it("qualifies a supported claim whose dependency was removed, and drops the link", async () => {
    const built = await buildClaims(
      [
        { key: "salt", text: "Adding salt makes pasta water boil much faster.", scope: "cooking" },
        {
          key: "ice",
          text: "Ice is less dense than liquid water.",
          scope: "water",
          dependsOn: ["salt"],
        },
      ],
      [USGS],
      { judge: supportsAll },
    );
    expect(built.removed.map((item) => item.key)).toEqual(["salt"]);
    expect(built.claims[0]).toMatchObject({ status: "qualified", dependsOn: [] });
  });

  it("qualifies a supported claim that depends on an open question", async () => {
    const built = await buildClaims(
      [
        {
          key: "q",
          text: "Unicorns prefer cold lakes.",
          scope: "lakes",
          openQuestion: "Do unicorns prefer cold lakes?",
        },
        {
          key: "ice",
          text: "Ice is less dense than liquid water.",
          scope: "water",
          dependsOn: ["q"],
        },
      ],
      [USGS],
      { judge: supportsAll },
    );
    expect(built.claims.find((claim) => claim.claimId === built.ids.ice)).toMatchObject({
      status: "qualified",
      uncertainty: "It builds on a step we could not verify.",
      dependsOn: [built.ids.q],
    });
  });

  it("rejects unknown dependencies and cycles before calling the judge", async () => {
    const judge = scriptedJudge({});
    await expect(
      buildClaims([{ key: "a", text: "A.", scope: "s", dependsOn: ["missing"] }], [USGS], {
        judge,
      }),
    ).rejects.toBeInstanceOf(ClaimGraphError);
    await expect(
      buildClaims(
        [
          { key: "a", text: "A.", scope: "s", dependsOn: ["b"] },
          { key: "b", text: "B.", scope: "s", dependsOn: ["a"] },
        ],
        [USGS],
        { judge },
      ),
    ).rejects.toThrow(/cycle/);
    expect(judge.judge).not.toHaveBeenCalled();
  });

  it("produces records that pass the contracts", async () => {
    const built = await buildClaims(
      [{ key: "ice", text: "Ice is less dense than liquid water.", scope: "water" }],
      [USGS, NIST],
      { judge: supportsAll },
    );
    for (const claim of built.claims) expect(Claim.parse(claim)).toEqual(claim);
  });
});

describe("claim graph", () => {
  const id = (n: number) => `0192f1a0-0000-7000-8000-00000000010${n}`;
  const claim = (n: number, dependsOn: number[] = []): ClaimRecord =>
    Claim.parse({
      claimId: id(n),
      text: `Claim ${n}.`,
      status: "unsupported",
      scope: "test",
      confidence: "low",
      uncertainty: "test",
      dependsOn: dependsOn.map(id),
    });

  it("answers direct and transitive dependencies and dependents", () => {
    const graph = createClaimGraph([claim(1), claim(2, [1]), claim(3, [2]), claim(4, [1])]);
    expect(graph.dependentsOf(id(1))).toEqual([id(2), id(4)]);
    expect(graph.dependentsOf(id(1), { transitive: true }).sort()).toEqual([id(2), id(3), id(4)]);
    expect(graph.dependenciesOf(id(3), { transitive: true })).toEqual([id(2), id(1)]);
    expect(
      graph
        .ordered()
        .map((item) => item.claimId)
        .indexOf(id(1)),
    ).toBe(0);
  });

  it("refuses cycles", () => {
    expect(() => createClaimGraph([claim(1, [2]), claim(2, [1])])).toThrow(ClaimGraphError);
  });

  it("collects stored dependents through the repository", async () => {
    const repos = createMemoryEvidenceRepositories();
    for (const item of [claim(1), claim(2, [1]), claim(3, [2]), claim(5)])
      await repos.claims.save(item);
    expect((await collectDependents(repos.claims, [id(1)])).sort()).toEqual([id(2), id(3)]);
    expect((await repos.claims.findDependents(id(2))).map((item) => item.claimId)).toEqual([id(3)]);
  });
});

describe("saveClaimGraph", () => {
  it("merges a re-fetched source into the stored one and remaps citations", async () => {
    const repos = createMemoryEvidenceRepositories();
    const first = await buildClaims(
      [{ key: "ice", text: "Ice is less dense than liquid water.", scope: "water" }],
      [USGS],
      { judge: supportsAll },
    );
    const saved = await saveClaimGraph(repos, first);
    const second = await buildClaims(
      [{ key: "boil", text: "Water boils at 100 °C at sea level.", scope: "pure water" }],
      [USGS],
      { judge: supportsAll },
    );
    const again = await saveClaimGraph(repos, second);

    const sourceId = saved.sources[0]?.sourceId ?? "";
    const stored = await repos.sources.get(sourceId);
    expect(again.sources[0]?.sourceId).toBe(sourceId);
    expect(stored?.excerpts.map((excerpt) => excerpt.excerptId)).toEqual(["x1", "x2"]);
    expect(stored?.claimIds).toHaveLength(2);
    expect(again.claims[0]?.citations).toEqual([{ sourceId, excerptId: "x2" }]);
    expect((await repos.claims.findBySource(sourceId)).map((item) => item.claimId).sort()).toEqual(
      [saved.claims[0]?.claimId, again.claims[0]?.claimId].sort(),
    );
  });
});

describe("createLlmSupportJudge", () => {
  function llm(text: string): LlmProvider {
    return {
      id: "fake",
      model: "fake-model",
      complete: vi.fn(async () => ({
        text,
        model: "fake-model",
        latencyMs: 1,
        usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
      })),
    };
  }
  const question = {
    claim: "Water boils at 100 °C at sea level.",
    scope: "pure water",
    excerpt: "Water boils at 100 °C at sea level.",
    location: "paragraph 3",
    sourceTitle: "Water",
  };

  it("asks the model to judge from the excerpt alone", async () => {
    const provider = llm(JSON.stringify({ verdict: "supports", reason: "States it directly." }));
    const judge = createLlmSupportJudge(provider);
    expect(await judge.judge(question)).toEqual({
      verdict: "supports",
      reason: "States it directly.",
    });
    expect(judge.version).toBe("fake-model+evidence-judge-p0.1");
    const request = vi.mocked(provider.complete).mock.calls[0]?.[0];
    expect(request?.messages[0]?.content).toContain("Judge only from the excerpt");
    expect(request?.messages[1]?.content).toContain('Excerpt: """Water boils');
  });

  it("treats a malformed answer as no support", async () => {
    for (const text of ["not json", JSON.stringify({ verdict: "maybe" })]) {
      expect((await createLlmSupportJudge(llm(text)).judge(question)).verdict).toBe("insufficient");
    }
  });
});
