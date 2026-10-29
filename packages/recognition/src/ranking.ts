import { Certainty, type RecognitionCandidate } from "@sbi/contracts";
import { createEnv, type EnvSource } from "@sbi/env";
import { z } from "zod";
import type { RecognitionOutput } from "./vision-llm-recogniser";

type Candidate = z.output<typeof RecognitionCandidate>;
type Output = z.infer<typeof RecognitionOutput>;

/** Structural subset of `@sbi/taxonomy`'s `Taxonomy`, so ranking needs no taxonomy dependency. */
export interface LabelResolver {
  resolve(label: string): { entry: { id: string; label: string }; part?: { label: string } }[];
}

export interface Calibration {
  version: string;
  map(score: number): number;
}

export interface RankingConfig {
  /** Lowest calibrated confidence for each band; anything lower is "unsure". */
  bands: { likely: number; possible: number };
  calibration: Calibration;
  lessonGate: { minCertainty: Certainty; minMargin: number };
  maxCandidates: number;
}

export interface RankedRecognition {
  candidates: Candidate[];
  /** Model labels the taxonomy does not know yet, kept for catalog prioritisation. */
  unmapped: string[];
  calibrationVersion: string;
}

export type LessonGate =
  | { status: "ready"; candidate: Candidate }
  | {
      status: "needs-confirmation";
      reason: "no-candidates" | "low-certainty" | "close-alternatives";
    };

// Identity until the benchmark has enough labelled photos to fit a per-provider curve.
export const UNCALIBRATED: Calibration = { version: "uncalibrated-v0", map: (score) => score };

const ORDER: Record<Certainty, number> = { unsure: 0, possible: 1, likely: 2 };

const lower = (a: Certainty, b: Certainty): Certainty => (ORDER[a] <= ORDER[b] ? a : b);

const envSchema = z.object({
  RECOGNITION_BAND_LIKELY: z.coerce.number().gt(0).max(1).default(0.8),
  RECOGNITION_BAND_POSSIBLE: z.coerce.number().gt(0).max(1).default(0.5),
  RECOGNITION_LESSON_MIN_CERTAINTY: Certainty.default("likely"),
  RECOGNITION_LESSON_MIN_MARGIN: z.coerce.number().min(0).max(1).default(0.2),
});

export function parseRankingConfig(source: EnvSource): RankingConfig {
  const env = createEnv(envSchema, source);
  const config: RankingConfig = {
    bands: { likely: env.RECOGNITION_BAND_LIKELY, possible: env.RECOGNITION_BAND_POSSIBLE },
    calibration: UNCALIBRATED,
    lessonGate: {
      minCertainty: env.RECOGNITION_LESSON_MIN_CERTAINTY,
      minMargin: env.RECOGNITION_LESSON_MIN_MARGIN,
    },
    maxCandidates: 3,
  };
  checkBands(config);
  return config;
}

function checkBands({ bands }: RankingConfig) {
  if (bands.likely <= bands.possible) {
    throw new Error("The likely threshold must exceed the possible threshold");
  }
}

export const DEFAULT_RANKING_CONFIG: RankingConfig = parseRankingConfig({});

function band(score: number, { bands }: RankingConfig): Certainty {
  return score >= bands.likely ? "likely" : score >= bands.possible ? "possible" : "unsure";
}

function clamp(score: number) {
  return Math.min(1, Math.max(0, score));
}

/** Maps model labels to taxonomy objects and qualitative bands; never raises certainty. */
export function rankCandidates(
  output: Output,
  resolver: LabelResolver,
  config: RankingConfig = DEFAULT_RANKING_CONFIG,
): RankedRecognition {
  checkBands(config);
  const merged = new Map<string, Candidate>();
  const unmapped: string[] = [];
  const raw = output.status === "unsupported" ? [] : output.candidates;
  const strongestFirst = [...raw].sort((a, b) => b.calibratedConfidence - a.calibratedConfidence);

  for (const candidate of strongestFirst) {
    const matches = resolver.resolve(candidate.label);
    if (matches.length === 0) {
      unmapped.push(candidate.label);
      continue;
    }
    const score = clamp(config.calibration.map(candidate.calibratedConfidence));
    let certainty = lower(band(score, config), candidate.certainty);
    // A label that fits several objects, or a photo the model called ambiguous, is never "likely".
    if (matches.length > 1 || output.status === "ambiguous") {
      certainty = lower(certainty, "possible");
    }
    for (const { entry, part } of matches) {
      const partReason = part
        ? [`Shows the ${part.label.toLowerCase()} of a ${entry.label.toLowerCase()}.`]
        : [];
      const reasons = [...partReason, ...candidate.reasons];
      const existing = merged.get(entry.id);
      if (existing) {
        existing.reasons = [...new Set([...existing.reasons, ...reasons])];
        continue;
      }
      merged.set(entry.id, {
        taxonomyId: entry.id,
        label: entry.label,
        certainty,
        calibratedConfidence: score,
        reasons:
          reasons.length > 0
            ? reasons
            : output.observations.length > 0
              ? [...output.observations]
              : [`The photo matches what a ${entry.label.toLowerCase()} looks like.`],
      });
    }
  }

  const candidates = [...merged.values()]
    .sort(
      (a, b) => b.calibratedConfidence - a.calibratedConfidence || a.label.localeCompare(b.label),
    )
    .slice(0, config.maxCandidates);
  return { candidates, unmapped, calibrationVersion: config.calibration.version };
}

/** Decides whether a lesson may start from the top candidate or the learner must choose first. */
export function gateLesson(
  { candidates }: RankedRecognition,
  { lessonGate }: RankingConfig = DEFAULT_RANKING_CONFIG,
): LessonGate {
  const [top, runnerUp] = candidates;
  if (!top) {
    return { status: "needs-confirmation", reason: "no-candidates" };
  }
  if (ORDER[top.certainty] < ORDER[lessonGate.minCertainty]) {
    return { status: "needs-confirmation", reason: "low-certainty" };
  }
  if (runnerUp && top.calibratedConfidence - runnerUp.calibratedConfidence < lessonGate.minMargin) {
    return { status: "needs-confirmation", reason: "close-alternatives" };
  }
  return { status: "ready", candidate: top };
}
