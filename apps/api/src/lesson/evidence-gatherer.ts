import type { DatabaseHandle, Repositories } from "@sbi/db";
import {
  createCitationResolver,
  createDefaultRetriever,
  createLibreTextsIndex,
  createPoliteFetcher,
  discoverReferences,
  gatherEvidence,
  searchWikipedia,
  userAgentWith,
} from "@sbi/evidence";
import type { LlmProvider } from "@sbi/llm";
import type { ApiEnv } from "../env";
import { createEvidenceJudge } from "../evidence/judge";
import type { EvidenceGatherer } from "./lesson.service";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// The database lock never waits, so concurrent requests retry briefly before giving up.
function waitingLock(database: Pick<DatabaseHandle, "withLock">) {
  return async <T>(task: () => Promise<T>): Promise<T> => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const result = await database.withLock("evidence-ingest", task);
      if (result.acquired) return result.value;
      await sleep(250);
    }
    throw new Error("Another request kept the evidence lock for too long.");
  };
}

export interface GathererDeps {
  provider: LlmProvider | null;
  env: Pick<ApiEnv, "EVIDENCE_CONTACT" | "lessonSource">;
  repositories: Pick<Repositories, "claims" | "evidenceSources" | "evidencePacks">;
  database: Pick<DatabaseHandle, "withLock">;
}

/** Wires gatherEvidence to the lesson model, the evidence judge and the trusted sources. */
export function createEvidenceGatherer(deps: GathererDeps): EvidenceGatherer {
  const http = { userAgent: userAgentWith(deps.env.EVIDENCE_CONTACT), retryDelayMs: 3000 };
  const repositories = {
    claims: deps.repositories.claims,
    sources: deps.repositories.evidenceSources,
  };
  // One index per process: building it reads every open book's sitemap.
  const libretexts = createLibreTextsIndex({
    fetcher: createPoliteFetcher({ ...http, maxBytes: 20_000_000, timeoutMs: 90_000 }),
  });
  const retriever = createDefaultRetriever(http);
  return async (input, options) => {
    if (!deps.provider) throw new Error("Lesson generation has no provider configured.");
    return gatherEvidence(
      input,
      {
        provider: deps.provider,
        judge: createEvidenceJudge(deps.env.lessonSource),
        retriever,
        repositories,
        resolver: createCitationResolver(repositories),
        packs: deps.repositories.evidencePacks,
        lock: waitingLock(deps.database),
        search: {
          libretexts,
          searchWikipedia: (query, limit, signal) => searchWikipedia(query, limit, http, signal),
          discoverReferences: (title, signal) => discoverReferences(title, http, signal),
        },
      },
      { budgetMs: 150_000, ...options },
    );
  };
}
