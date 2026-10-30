import { createHash } from "node:crypto";
import type { Claim } from "@sbi/contracts";
import type { LlmProvider } from "@sbi/llm";
import { z } from "zod";
import type { CitationResolver } from "../citations/resolver";
import type { SupportJudge } from "../claims/judge";
import { type EvidenceRepositories, saveClaimGraph } from "../claims/persist";
import { extractAndVerify } from "../extract/extract";
import { Discipline, type InquiryInput, type InquiryQuestion, planInquiry } from "../plan/inquiry";
import type { Retriever } from "../retrieval/retriever";
import type { FetchedSource } from "../retrieval/types";
import { searchSources, type SourceSearchDeps } from "../search/search";

/** What one request gathered: the plan, and the stored claims found for each sub-question. */
export const EvidencePack = z.object({
  packKey: z.string().regex(/^[a-f0-9]{64}$/),
  taxonomyId: z.string().min(1),
  planVersion: z.string().min(1),
  createdAt: z.iso.datetime({ offset: true }),
  questions: z.array(
    z.object({
      key: z.string().min(1),
      discipline: Discipline,
      question: z.string().min(1),
      claimIds: z.array(z.uuid()),
      sources: z.number().int().nonnegative(),
      failures: z.array(z.string()),
      completed: z.boolean(),
    }),
  ),
});

export type EvidencePack = z.infer<typeof EvidencePack>;

export interface EvidencePackRepository {
  get(packKey: string): Promise<EvidencePack | undefined>;
  save(pack: EvidencePack): Promise<void>;
}

export function createMemoryEvidencePackRepository(): EvidencePackRepository {
  const packs = new Map<string, EvidencePack>();
  return {
    async get(packKey) {
      const pack = packs.get(packKey);
      return pack && structuredClone(pack);
    },
    async save(pack) {
      packs.set(pack.packKey, structuredClone(EvidencePack.parse(pack)));
    },
  };
}

/** Same object and question, worded loosely the same, share one pack. */
export function evidencePackKey(taxonomyId: string, question: string): string {
  const normalised = question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return createHash("sha256").update(`${taxonomyId}\n${normalised}`).digest("hex");
}

export type GatherEvent =
  | { type: "planned"; questions: InquiryQuestion[] }
  | { type: "verified"; key: string; claims: Claim[] }
  | { type: "reused"; claims: Claim[] };

export interface GatherDeps {
  provider: LlmProvider;
  judge: SupportJudge;
  retriever: Retriever;
  search: SourceSearchDeps;
  repositories: EvidenceRepositories;
  resolver: CitationResolver;
  packs: EvidencePackRepository;
  /** Serialises claim saves across concurrent requests (see saveClaimGraph). */
  lock?: <T>(task: () => Promise<T>) => Promise<T>;
  now?: () => Date;
}

export interface GatherOptions {
  /** Work still running after this is abandoned; whatever finished is kept. */
  budgetMs?: number;
  concurrency?: number;
  /** A reused pack is regathered once fewer than this many of its claims still resolve. */
  minFreshClaims?: number;
  maxAgeDays?: number;
  onEvent?: (event: GatherEvent) => void;
  signal?: AbortSignal;
}

export interface GatheredEvidence {
  pack: EvidencePack;
  claims: Claim[];
  reused: boolean;
}

async function freshClaims(pack: EvidencePack, resolver: CitationResolver): Promise<Claim[]> {
  const ids = [...new Set(pack.questions.flatMap((question) => question.claimIds))];
  const resolved = await Promise.all(
    ids.map((id) =>
      resolver.resolveClaim(id).then(
        (result) => result.claim,
        () => undefined,
      ),
    ),
  );
  return resolved.filter((claim): claim is Claim => claim !== undefined);
}

async function inParallel<T>(items: T[], size: number, task: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await task(item);
    }),
  );
}

/** Plans, searches, fetches, extracts and verifies evidence for one request, or reuses a pack. */
export async function gatherEvidence(
  input: InquiryInput & { taxonomyId: string },
  deps: GatherDeps,
  options: GatherOptions = {},
): Promise<GatheredEvidence> {
  const now = deps.now ?? (() => new Date());
  const packKey = evidencePackKey(input.taxonomyId, input.question);
  const stored = await deps.packs.get(packKey);
  const maxAgeMs = (options.maxAgeDays ?? 30) * 86_400_000;
  if (stored && now().getTime() - Date.parse(stored.createdAt) < maxAgeMs) {
    // Claims whose sources changed no longer resolve, so freshness invalidation reaches packs.
    const claims = await freshClaims(stored, deps.resolver);
    if (claims.length >= (options.minFreshClaims ?? 3)) {
      options.onEvent?.({ type: "reused", claims });
      return { pack: stored, claims, reused: true };
    }
  }

  const budget = AbortSignal.timeout(options.budgetMs ?? 120_000);
  const signal = options.signal ? AbortSignal.any([options.signal, budget]) : budget;
  const plan = await planInquiry(input, { provider: deps.provider, signal });
  options.onEvent?.({ type: "planned", questions: plan.questions });

  const lock = deps.lock ?? ((task) => task());
  const results = new Map<string, EvidencePack["questions"][number]>();
  const gathered: Claim[] = [];
  for (const question of plan.questions) {
    results.set(question.key, {
      key: question.key,
      discipline: question.discipline,
      question: question.question,
      claimIds: [],
      sources: 0,
      failures: [],
      completed: false,
    });
  }

  await inParallel(plan.questions, options.concurrency ?? 3, async (question) => {
    const result = results.get(question.key) as EvidencePack["questions"][number];
    try {
      const found = await searchSources(question, deps.search, { signal });
      result.failures.push(...found.failures);
      const fetched: FetchedSource[] = [];
      for (const ref of found.refs) {
        try {
          fetched.push(await deps.retriever.retrieve(ref, { signal }));
        } catch (error) {
          if (signal.aborted) throw error;
          result.failures.push(`fetch: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      result.sources = fetched.filter((source) => source.passages.length > 0).length;
      const built = await extractAndVerify(question, fetched, {
        provider: deps.provider,
        judge: deps.judge,
        now: deps.now,
        signal,
      });
      const saved = await lock(() => saveClaimGraph(deps.repositories, built));
      result.claimIds = saved.claims.map((claim) => claim.claimId);
      result.completed = true;
      gathered.push(...saved.claims);
      options.onEvent?.({ type: "verified", key: question.key, claims: saved.claims });
    } catch (error) {
      // One slow or failing sub-question must not sink the others.
      result.failures.push(signal.aborted ? "stopped at the time budget" : String(error));
    }
  });

  const pack = EvidencePack.parse({
    packKey,
    taxonomyId: input.taxonomyId,
    planVersion: plan.version,
    createdAt: now().toISOString(),
    questions: plan.questions.map((question) => results.get(question.key)),
  });
  // A pack cut short by the budget is still useful now, but is not kept for reuse.
  if (pack.questions.every((question) => question.completed)) await deps.packs.save(pack);
  return { pack, claims: gathered, reused: false };
}
