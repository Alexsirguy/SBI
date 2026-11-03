import type { Claim } from "@sbi/contracts";
import type { LlmProvider } from "@sbi/llm";
import type { RiskClassifier } from "@sbi/safety";
import { runTutorTurn } from "../pipeline";
import type { EvalCase, EvalSet } from "./dataset";
import type { Entailment, EvalRecord } from "./score";

/** Says whether the cited claims back the reply; the orchestrator's judge in a real run. */
export type Judge = (text: string, cited: Claim[]) => Promise<Entailment>;

export interface EvalDeps {
  provider: LlmProvider;
  classify: RiskClassifier;
  judge: Judge;
  concurrency?: number;
  onRecord?: (record: EvalRecord) => void;
}

const SESSION = "0192f1a0-0000-7000-8000-00000000e7a1";

async function runCase(deps: EvalDeps, set: EvalSet, item: EvalCase): Promise<EvalRecord> {
  const { lesson, manifest } = set.lessons[item.lesson] ?? {};
  const base = {
    caseId: item.id,
    expect: item.expect,
    locale: item.locale,
    show: item.show,
    expectedClaims: item.claims,
  };
  if (!lesson) return { ...base, error: `unknown lesson ${item.lesson}` };
  try {
    // Each case is its own first question, so one reply never leans on another.
    const turn = await runTutorTurn(
      { provider: deps.provider, classify: deps.classify },
      {
        lesson,
        question: {
          sessionId: SESSION,
          lessonId: lesson.lessonId,
          lessonVersion: lesson.version,
          text: item.question,
          audience: item.audience,
          readingLevel: item.readingLevel,
          locale: item.locale,
        },
        history: [],
        ...(manifest ? { manifest } : {}),
      },
    );
    const cited = lesson.claims.filter((claim) =>
      turn.response.citedClaimIds.includes(claim.claimId),
    );
    const entailment =
      turn.response.kind === "lesson" ? await deps.judge(turn.response.text, cited) : undefined;
    return { ...base, turn, ...(entailment ? { entailment } : {}) };
  } catch (error) {
    return { ...base, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Runs every case through the real pipeline, a few at a time, in the set's order. */
export async function runTutorEval(deps: EvalDeps, set: EvalSet): Promise<EvalRecord[]> {
  const records: EvalRecord[] = new Array(set.cases.length);
  let next = 0;
  const worker = async () => {
    while (next < set.cases.length) {
      const index = next++;
      const item = set.cases[index];
      if (!item) continue;
      const record = await runCase(deps, set, item);
      records[index] = record;
      deps.onRecord?.(record);
    }
  };
  await Promise.all(Array.from({ length: deps.concurrency ?? 4 }, worker));
  return records;
}
