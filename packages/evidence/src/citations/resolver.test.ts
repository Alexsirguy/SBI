import { type Claim, newId } from "@sbi/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { buildClaims } from "../claims/builder";
import type { SupportJudge } from "../claims/judge";
import { saveClaimGraph } from "../claims/persist";
import { createMemoryEvidenceRepositories, type MemoryEvidenceRepositories } from "../memory";
import type { FetchedSource } from "../retrieval/types";
import { CitationError, createCitationResolver, type CitationResolver } from "./resolver";

const USGS: FetchedSource = {
  title: "Water Density",
  publisher: "U.S. Geological Survey",
  authors: [],
  url: "https://www.usgs.gov/water-density",
  sourceType: "institution",
  passages: [
    {
      location: "paragraph 4",
      text: "The density of water is 0.9998395 g/ml at 4.0° Celsius.",
    },
    {
      location: "paragraph 5",
      text: "Ice is less dense than liquid water, which is why ice floats.",
    },
  ],
  rightsStatus: "reusable",
  retrieval: {
    connector: "us-gov",
    fetchedAt: "2026-10-29T09:00:00.000Z",
    access: "full-text",
    contentSha256: "c".repeat(64),
  },
};

const supportsAll: SupportJudge = {
  version: "always",
  judge: async () => ({ verdict: "supports", reason: "ok" }),
};

describe("citation resolver", () => {
  let repos: MemoryEvidenceRepositories;
  let resolver: CitationResolver;
  let claim: Claim;
  let openQuestion: Claim;

  beforeEach(async () => {
    repos = createMemoryEvidenceRepositories();
    resolver = createCitationResolver(repos);
    const built = await buildClaims(
      [
        {
          key: "ice",
          text: "Ice floats because it is less dense than liquid water.",
          scope: "water",
        },
        {
          key: "salt",
          text: "Salt makes water boil much faster.",
          scope: "cooking",
          openQuestion: "Does salt change how fast water boils?",
        },
      ],
      [USGS],
      { judge: supportsAll },
    );
    const saved = await saveClaimGraph(repos, built);
    [claim, openQuestion] = saved.claims as [Claim, Claim];
  });

  it("resolves a claim to the stored excerpt it cites", async () => {
    const resolved = await resolver.resolveClaim(claim.claimId);
    expect(resolved.excerpts).toEqual([
      expect.objectContaining({
        title: "Water Density",
        location: "paragraph 5",
        text: "Ice is less dense than liquid water, which is why ice floats.",
        rightsStatus: "reusable",
      }),
    ]);
  });

  it("resolves an open question with no sources", async () => {
    expect((await resolver.resolveClaim(openQuestion.claimId)).excerpts).toEqual([]);
  });

  it("accepts a quote that is in the excerpt, ignoring case, spacing and curly quotes", async () => {
    const [citation] = claim.citations ?? [];
    await expect(
      resolver.resolveExcerpt({
        ...(citation as { sourceId: string; excerptId: string }),
        quote: "ICE  is less dense",
      }),
    ).resolves.toMatchObject({ location: "paragraph 5" });
  });

  describe("fabricated citations", () => {
    const rejects = async (promise: Promise<unknown>, kind: string) => {
      const error = await promise.then(
        () => undefined,
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(CitationError);
      expect((error as CitationError).problems.map((problem) => problem.kind)).toContain(kind);
    };

    it("rejects an invented source id", async () => {
      await rejects(
        resolver.resolveExcerpt({ sourceId: newId(), excerptId: "x1" }),
        "unknown-source",
      );
    });

    it("rejects a URL or DOI in place of a stored source id, without fetching anything", async () => {
      await rejects(
        resolver.resolveExcerpt({ sourceId: "https://doi.org/10.1000/made-up", excerptId: "x1" }),
        "unknown-source",
      );
    });

    it("rejects a real source with an invented excerpt id", async () => {
      const sourceId = claim.sourceIds[0] ?? "";
      await rejects(resolver.resolveExcerpt({ sourceId, excerptId: "x9" }), "unknown-excerpt");
    });

    it("rejects words the source never said", async () => {
      const [citation] = claim.citations ?? [];
      await rejects(
        resolver.resolveExcerpt({
          ...(citation as { sourceId: string; excerptId: string }),
          quote: "ice is denser than liquid water",
        }),
        "quote-not-in-excerpt",
      );
    });

    it("rejects a claim id that is not in the store", async () => {
      await rejects(resolver.resolveClaim(newId()), "unknown-claim");
    });

    it("rejects a stored claim whose citation points at a missing excerpt", async () => {
      const sourceId = claim.sourceIds[0] ?? "";
      await repos.claims.save({ ...claim, citations: [{ sourceId, excerptId: "x9" }] });
      await rejects(resolver.resolveClaim(claim.claimId), "unknown-excerpt");
    });

    it("rejects a claim shown as fact without any excerpt", async () => {
      await repos.claims.save({ ...claim, citations: [] });
      await rejects(resolver.resolveClaim(claim.claimId), "no-excerpt");
    });

    it("rejects a claim that borrows a real source which never backed it", async () => {
      const sourceId = claim.sourceIds[0] ?? "";
      const borrowed = {
        ...claim,
        claimId: newId(),
        text: "Water is densest at 0 °C.",
        citations: [{ sourceId, excerptId: "x1" }],
      };
      await repos.claims.save(borrowed);
      await rejects(resolver.resolveClaim(borrowed.claimId), "source-not-linked");
    });
  });

  it("rejects an excerpt the freshness check found missing or gone", async () => {
    const [citation] = claim.citations ?? [];
    const ref = citation as { sourceId: string; excerptId: string };
    const source = await repos.sources.get(ref.sourceId);
    const checkedAt = "2026-10-29T10:00:00Z";
    await repos.sources.save({
      ...(source as NonNullable<typeof source>),
      freshness: { status: "changed", checkedAt, missingExcerptIds: [ref.excerptId] },
    });
    await expect(resolver.resolveExcerpt(ref)).rejects.toMatchObject({
      problems: [{ kind: "stale-excerpt" }],
    });
    await expect(resolver.checkLesson({ claims: [claim] })).resolves.toEqual([
      { kind: "stale-excerpt", ...ref, claimId: claim.claimId },
      { kind: "no-excerpt", claimId: claim.claimId },
    ]);
  });

  describe("checkLesson", () => {
    it("passes a lesson whose claims match the store", async () => {
      expect(await resolver.checkLesson({ claims: [claim, openQuestion] })).toEqual([]);
    });

    it("flags a claim id the generator invented", async () => {
      const invented = { ...claim, claimId: newId() };
      expect(await resolver.checkLesson({ claims: [invented] })).toEqual([
        { kind: "unknown-claim", claimId: invented.claimId },
      ]);
    });

    it("flags a real claim id with changed words or a promoted status", async () => {
      const reworded = { ...claim, text: "Ice always floats, even on oil." };
      const promoted: Claim = { ...openQuestion, status: "supported", sourceIds: claim.sourceIds };
      const problems = await resolver.checkLesson({ claims: [reworded, promoted] });
      expect(problems).toEqual([
        { kind: "claim-mismatch", claimId: claim.claimId },
        { kind: "claim-mismatch", claimId: openQuestion.claimId },
      ]);
    });
  });
});
