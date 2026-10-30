import type { Completion, CompletionRequest, LlmProvider } from "@sbi/llm";
import { describe, expect, it, vi } from "vitest";
import { createCitationResolver } from "../citations/resolver";
import type { SupportJudge } from "../claims/judge";
import { createMemoryEvidenceRepositories } from "../memory";
import type { Retriever } from "../retrieval/retriever";
import type { FetchedSource } from "../retrieval/types";
import {
  createMemoryEvidencePackRepository,
  EvidencePack,
  evidencePackKey,
  gatherEvidence,
  type GatherDeps,
  type GatherEvent,
} from "./pack";

const PLAN = {
  questions: [
    {
      key: "q1",
      discipline: "physics",
      question: "How does current heat a wire?",
      searchTerms: ["electric current heat", "resistance"],
      wikipediaArticles: [],
      dependsOn: [],
    },
    {
      key: "q2",
      discipline: "physics",
      question: "Why does boiling water stay at one temperature?",
      searchTerms: ["boiling latent heat"],
      wikipediaArticles: [],
      dependsOn: [],
    },
  ],
};

function book(url: string, text: string): FetchedSource {
  return {
    title: url,
    publisher: new URL(url).hostname,
    authors: [],
    url,
    sourceType: "textbook",
    passages: [{ location: "paragraph 1", text }],
    rightsStatus: "reusable",
    retrieval: {
      connector: "open-textbook",
      fetchedAt: "2026-10-29T09:00:00.000Z",
      access: "full-text",
      contentSha256: "f".repeat(64),
    },
  };
}

const PAGES: Record<string, FetchedSource> = {
  "https://phys.libretexts.org/heat": book(
    "https://phys.libretexts.org/heat",
    "When electric current flows through a resistance, electrical energy turns into heat.",
  ),
  "https://chem.libretexts.org/boil": book(
    "https://chem.libretexts.org/boil",
    "Boiling water stays at one temperature because the added heat becomes latent heat.",
  ),
};

// Routes by prompt: the planner, then one extraction per sub-question.
function provider(): LlmProvider & { calls: CompletionRequest[] } {
  const calls: CompletionRequest[] = [];
  return {
    id: "stub",
    model: "stub-1",
    calls,
    async complete(request): Promise<Completion> {
      calls.push(request);
      const name = request.jsonSchema?.name;
      const user = String(request.messages[1]?.content);
      let text = "{}";
      if (name === "InquiryPlan") text = JSON.stringify(PLAN);
      if (name === "ExtractedClaims") {
        const heat = user.includes("current heat");
        text = JSON.stringify({
          claims: [
            heat
              ? {
                  text: "When electric current flows through a resistance, electrical energy turns into heat.",
                  excerptId: "e1",
                  quote: "electrical energy turns into heat",
                }
              : {
                  text: "Boiling water stays at one temperature because the added heat becomes latent heat.",
                  excerptId: "e1",
                  quote: "the added heat becomes latent heat",
                },
          ],
        });
      }
      return {
        text,
        model: "stub-1",
        latencyMs: 1,
        usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
      };
    },
  };
}

const judge: SupportJudge = {
  version: "t",
  judge: async ({ excerpt }) => ({ verdict: "supports", reason: "ok", quote: excerpt }),
};

function deps(overrides: Partial<GatherDeps> = {}) {
  const repositories = createMemoryEvidenceRepositories();
  const retriever: Retriever = {
    retrieve: vi.fn(async (ref) => {
      const page = PAGES[ref.url ?? ""];
      if (!page) throw new Error("missing");
      return page;
    }),
    discover: vi.fn(),
  };
  const base: GatherDeps = {
    provider: provider(),
    judge,
    retriever,
    repositories,
    resolver: createCitationResolver(repositories),
    packs: createMemoryEvidencePackRepository(),
    search: {
      searchWikipedia: async () => [],
      discoverReferences: async () => [],
      libretexts: {
        search: async (query) =>
          query.includes("current heat")
            ? ["https://phys.libretexts.org/heat"]
            : ["https://chem.libretexts.org/boil"],
      },
    },
    now: () => new Date("2026-10-29T09:00:00Z"),
  };
  return { ...base, ...overrides };
}

const input = {
  taxonomyId: "object.electric-kettle",
  objectLabel: "Electric kettle",
  question: "How does a kettle boil water?",
  concepts: ["boiling"],
  audience: "general",
  readingLevel: "plain",
  safetyClass: "low" as const,
};

describe("gatherEvidence", () => {
  it("plans, searches, fetches, extracts, verifies and stores claims per sub-question", async () => {
    const events: GatherEvent[] = [];
    const target = deps();
    const result = await gatherEvidence(input, target, { onEvent: (event) => events.push(event) });

    expect(result.reused).toBe(false);
    expect(result.claims.map((claim) => claim.text).sort()).toEqual([
      "Boiling water stays at one temperature because the added heat becomes latent heat.",
      "When electric current flows through a resistance, electrical energy turns into heat.",
    ]);
    expect(result.pack.questions.every((question) => question.completed)).toBe(true);
    expect(result.pack.questions.find((question) => question.key === "q1")?.yield).toEqual({
      passages: 1,
      proposed: 1,
      ungrounded: 0,
      unsupported: 0,
      contradicted: 0,
    });
    for (const question of result.pack.questions) {
      expect(Object.keys(question.timings ?? {}).sort()).toEqual([
        "fetchMs",
        "searchMs",
        "verifyMs",
      ]);
    }
    expect(result.pack.questions.find((question) => question.key === "q1")?.searched).toEqual({
      query: "electric current heat resistance",
      articles: [],
      textbookPages: ["https://phys.libretexts.org/heat"],
      refs: ["https://phys.libretexts.org/heat"],
    });
    expect(events.map((event) => event.type)).toEqual(["planned", "verified", "verified"]);
    for (const claim of result.claims) {
      expect(await target.repositories.claims.get(claim.claimId)).toEqual(claim);
    }
    expect(await target.packs.get(evidencePackKey(input.taxonomyId, input.question))).toEqual(
      result.pack,
    );
  });

  it("lets a page found for one sub-question corroborate another's claim", async () => {
    const url = "https://bio.libretexts.org/boiling";
    const second = book(
      url,
      "While water boils, the added heat becomes latent heat, so it stays at one temperature.",
    );
    const pages: Record<string, FetchedSource> = { ...PAGES, [url]: second };
    const topical: SupportJudge = {
      version: "t",
      judge: async ({ claim, excerpt }) => ({
        verdict:
          claim.includes("latent") === excerpt.includes("latent") ? "supports" : "insufficient",
        reason: "ok",
        quote: excerpt,
      }),
    };
    const base = deps();
    const result = await gatherEvidence(
      input,
      deps({
        judge: topical,
        retriever: {
          ...base.retriever,
          retrieve: vi.fn(async (ref) => pages[ref.url ?? ""] as FetchedSource),
        },
        search: {
          ...base.search,
          libretexts: {
            search: async (query) =>
              query.includes("current heat")
                ? ["https://phys.libretexts.org/heat", url]
                : ["https://chem.libretexts.org/boil"],
          },
        },
      }),
      { concurrency: 1 },
    );
    const boiling = result.claims.find((claim) => claim.text.startsWith("Boiling"));
    expect(boiling?.sourceIds).toHaveLength(2);
    expect(boiling).toMatchObject({ status: "supported", confidence: "high" });
  });

  it("still reads packs stored before searches and timings were recorded", async () => {
    const { pack } = await gatherEvidence(input, deps());
    const older = {
      ...pack,
      questions: pack.questions.map(({ searched: _searched, ...question }) => question),
    };
    expect(EvidencePack.parse(older).questions[0]?.searched).toBeUndefined();
    const untimed = {
      ...pack,
      questions: pack.questions.map(({ timings: _timings, ...question }) => question),
    };
    expect(EvidencePack.parse(untimed).questions[0]?.timings).toBeUndefined();
  });

  it("reuses a stored pack while its claims still resolve to fresh excerpts", async () => {
    const target = deps();
    await gatherEvidence(input, target);
    const llm = target.provider as LlmProvider & { calls: CompletionRequest[] };
    const callsBefore = llm.calls.length;

    const again = await gatherEvidence(
      { ...input, question: "How does a KETTLE boil water" },
      target,
      { minFreshClaims: 2 },
    );
    expect(again.reused).toBe(true);
    expect(again.claims).toHaveLength(2);
    expect(llm.calls.length).toBe(callsBefore);
  });

  it("regathers once the pack's sources have gone stale", async () => {
    const target = deps();
    const first = await gatherEvidence(input, target);
    for (const claim of first.claims) {
      for (const source of await target.repositories.sources.getMany(claim.sourceIds)) {
        await target.repositories.sources.save({
          ...source,
          freshness: { status: "gone", checkedAt: "2026-10-30T00:00:00Z", missingExcerptIds: [] },
        });
      }
    }
    const again = await gatherEvidence(input, target, { minFreshClaims: 1 });
    expect(again.reused).toBe(false);
  });

  it("records a failed source search and still gathers the other sub-questions", async () => {
    const target = deps({
      search: {
        searchWikipedia: async () => [],
        discoverReferences: async () => [],
        libretexts: {
          search: async (query) => {
            if (query.includes("current heat")) throw new Error("index down");
            return ["https://chem.libretexts.org/boil"];
          },
        },
      },
    });
    const result = await gatherEvidence(input, target);
    expect(result.claims).toHaveLength(1);
    const first = result.pack.questions.find((question) => question.key === "q1");
    expect(first?.failures.join(" ")).toContain("index down");
    expect(await target.packs.get(result.pack.packKey)).toBeDefined();
  });

  it("stops at the time budget, keeps what finished, and does not store the pack", async () => {
    const slow: Retriever = {
      retrieve: vi.fn(
        (_ref, options) =>
          new Promise<FetchedSource>((_resolve, reject) => {
            options?.signal?.addEventListener("abort", () => reject(options.signal?.reason));
          }),
      ),
      discover: vi.fn(),
    };
    const target = deps({ retriever: slow });
    const result = await gatherEvidence(input, target, { budgetMs: 50 });
    expect(result.claims).toEqual([]);
    expect(result.pack.questions.every((question) => !question.completed)).toBe(true);
    // Stages that finished are timed; the cut-off fetch never records one.
    expect(result.pack.questions[0]?.timings?.searchMs).toBeGreaterThanOrEqual(0);
    expect(result.pack.questions[0]?.timings?.fetchMs).toBeUndefined();
    expect(await target.packs.get(result.pack.packKey)).toBeUndefined();
  });
});
