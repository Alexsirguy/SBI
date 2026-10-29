import { newId, RecognitionResult, type UserCorrection } from "@sbi/contracts";
import { createEnv, type EnvSource } from "@sbi/env";
import { z } from "zod";
import type { FallbackOutcome } from "./fallback";
import type { RankedRecognition } from "./ranking";

export interface RecognitionRetention {
  resultTtlDays: number;
}

const DAY_MS = 86_400_000;

// Long enough to measure calibration against corrections, short enough to stay minimal (§12).
const schema = z.object({
  RECOGNITION_RESULT_TTL_DAYS: z.coerce.number().int().positive().max(90).default(30),
});

export function parseRecognitionRetention(source: EnvSource): RecognitionRetention {
  return { resultTtlDays: createEnv(schema, source).RECOGNITION_RESULT_TTL_DAYS };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Buffer.from(digest).toString("hex");
}

export interface BuildRecognitionResultInput {
  image: Uint8Array;
  outcome: FallbackOutcome;
  ranked: RankedRecognition;
  sessionId: string;
  now: Date;
  retention: RecognitionRetention;
}

/** The photo never enters the record: only its SHA-256 links a result to an upload. */
export async function buildRecognitionResult(
  input: BuildRecognitionResultInput,
): Promise<RecognitionResult> {
  const { outcome, ranked, now } = input;
  return RecognitionResult.parse({
    resultId: newId(),
    sessionId: input.sessionId,
    imageSha256: await sha256Hex(input.image),
    provider: outcome.provider,
    model: outcome.model,
    // The prompt shapes the answer as much as the weights, so it is part of the version.
    modelVersion: `${outcome.model}+${outcome.promptVersion}`,
    calibrationVersion: ranked.calibrationVersion,
    candidates: ranked.candidates,
    observations: outcome.observations,
    createdAt: now.toISOString(),
    deleteBy: new Date(now.getTime() + input.retention.resultTtlDays * DAY_MS).toISOString(),
  });
}

/** A learner's own copy of an earlier answer for the same photo, without anyone's selection. */
export function copyRecognitionResult(
  source: RecognitionResult,
  { sessionId, now, retention }: { sessionId: string; now: Date; retention: RecognitionRetention },
): RecognitionResult {
  return RecognitionResult.parse({
    ...source,
    selectedTaxonomyId: undefined,
    userCorrection: undefined,
    resultId: newId(),
    sessionId,
    createdAt: now.toISOString(),
    deleteBy: new Date(now.getTime() + retention.resultTtlDays * DAY_MS).toISOString(),
  });
}

export interface Selection {
  taxonomyId?: string;
  correction?: z.input<typeof UserCorrection>;
}

/** Records what the learner confirmed; the contract rejects a choice that was never offered. */
export function withSelection(result: RecognitionResult, selection: Selection): RecognitionResult {
  return RecognitionResult.parse({
    ...result,
    selectedTaxonomyId: selection.taxonomyId,
    userCorrection: selection.correction,
  });
}
