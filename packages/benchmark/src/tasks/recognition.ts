import type { RecognitionOutcome } from "@sbi/recognition";
import { labelMatches } from "../match";
import type { SeedPrompt } from "../seed-set";

export interface RecognitionScore {
  // Unsupported photos have no right label, so they count only towards status accuracy.
  labelExpected: boolean;
  top1: boolean;
  top3: boolean;
  statusCorrect: boolean;
}

/** Scores one recognition outcome against the seed prompt's expectations. */
export function scoreRecognition(
  prompt: SeedPrompt,
  outcome: RecognitionOutcome,
): RecognitionScore {
  const labels = outcome.candidates.map((candidate) => candidate.label);
  const top = outcome.candidates[0];
  const expected = prompt.expected.recognition;
  const statusCorrect =
    expected === "confident"
      ? outcome.status === "recognised"
      : expected === "ambiguous"
        ? outcome.status === "ambiguous" || top?.certainty !== "likely"
        : outcome.status === "unsupported";
  return {
    labelExpected: expected === "confident" || expected === "ambiguous",
    top1: labels.length > 0 && labelMatches(labels[0] ?? "", prompt),
    top3: labels.some((label) => labelMatches(label, prompt)),
    statusCorrect,
  };
}
