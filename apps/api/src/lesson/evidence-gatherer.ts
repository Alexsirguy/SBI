import { Logger } from "@nestjs/common";
import type { DatabaseHandle, Repositories } from "@sbi/db";
import {
  createCitationResolver,
  createDefaultRetriever,
  createLibreTextsIndex,
  createPoliteFetcher,
  discoverReferences,
  evidencePackKey,
  gatherEvidence,
  searchWikipedia,
  storedEvidence,
  type GatheredEvidence,
  userAgentWith,
} from "@sbi/evidence";
import type { LlmProvider } from "@sbi/llm";
import type { ApiEnv } from "../env";
import { createEvidenceJudge } from "../evidence/judge";
import type { EvidenceGatherer } from "./lesson.service";

const logger = new Logger("EvidenceGather");

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
  env: Pick<ApiEnv, "EVIDENCE_CONTACT" | "EVIDENCE_BUDGET_MS" | "lessonSource">;
  repositories: Pick<Repositories, "claims" | "evidenceSources" | "evidencePacks">;
  database: Pick<DatabaseHandle, "withLock">;
}

/** Wires gatherEvidence to the lesson model, the evidence judge and the trusted sources. */
export function createEvidenceGatherer(deps: GathererDeps): EvidenceGatherer {
  const http = { userAgent: userAgentWith(deps.env.EVIDENCE_CONTACT), retryDelayMs: 3000 };
  // ADR 0016: a slow source is dropped rather than waited for; model knowledge fills the gap.
  const sourceHttp = { ...http, timeoutMs: 8000, attempts: 2 };
  const repositories = {
    claims: deps.repositories.claims,
    sources: deps.repositories.evidenceSources,
  };
  // One index per process: building it reads every open book's sitemap.
  const libretexts = createLibreTextsIndex({
    fetcher: createPoliteFetcher({ ...http, maxBytes: 20_000_000, timeoutMs: 90_000 }),
  });
  libretexts.warm();
  const retriever = createDefaultRetriever(sourceHttp);
  const gatherDeps = (provider: LlmProvider) => ({
    provider,
    judge: createEvidenceJudge(deps.env.lessonSource),
    retriever,
    repositories,
    resolver: createCitationResolver(repositories),
    packs: deps.repositories.evidencePacks,
    lock: waitingLock(deps.database),
    search: {
      libretexts,
      searchWikipedia: (query: string, limit: number, signal?: AbortSignal) =>
        searchWikipedia(query, limit, sourceHttp, signal),
      discoverReferences: (title: string, signal?: AbortSignal) =>
        discoverReferences(title, sourceHttp, signal),
    },
  });
  return async (input, options) => {
    if (!deps.provider) throw new Error("Lesson generation has no provider configured.");
    const gatherer = gatherDeps(deps.provider);
    return lessonFirst(evidencePackKey(input.taxonomyId, input.question), {
      stored: () => storedEvidence(input, gatherer, { onEvent: options.onEvent }),
      gather: () =>
        gatherEvidence(input, gatherer, { budgetMs: deps.env.EVIDENCE_BUDGET_MS, concurrency: 3 }),
    });
  };
}

// One background gather per pack, however many learners ask the same question meanwhile.
const running = new Map<string, Promise<void>>();

/**
 * ADR 0016: a stored pack is used at once; otherwise the lesson is drafted from model knowledge
 * while sources are gathered in the background for the next learner.
 */
export async function lessonFirst(
  packKey: string,
  steps: {
    stored: () => Promise<GatheredEvidence | undefined>;
    gather: () => Promise<GatheredEvidence>;
  },
): Promise<GatheredEvidence | undefined> {
  const stored = await steps.stored();
  if (stored) return stored;
  if (!running.has(packKey)) {
    const background = steps
      .gather()
      .then(logGathered, (error: unknown) => logger.warn(`Background gather failed: ${error}`))
      .finally(() => running.delete(packKey));
    running.set(packKey, background);
  }
  return undefined;
}

/** Settles once every background gather has finished. */
export async function backgroundGathers(): Promise<void> {
  await Promise.all(running.values());
}

// Keys, counts and failure reasons only; sub-questions that find nothing are otherwise silent.
function logGathered(gathered: GatheredEvidence) {
  for (const question of gathered.pack.questions ?? []) {
    logger.log(
      JSON.stringify({
        key: question.key,
        sources: question.sources,
        claims: question.claimIds.length,
        completed: question.completed,
        timings: question.timings,
        yield: question.yield,
        searched: question.searched && {
          textbookPages: question.searched.textbookPages.length,
          articles: question.searched.articles,
          refs: question.searched.refs.length,
        },
        failures: question.failures.map((failure) => failure.slice(0, 200)),
      }),
    );
  }
}
