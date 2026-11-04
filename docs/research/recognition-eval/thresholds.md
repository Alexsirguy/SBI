# Recognition evaluation: thresholds (#79)

`pnpm --filter @sbi/recognition eval` sends every seed-set photo (`docs/research/seed-set/v2`, Wikimedia images checked against their recorded hashes) to the recognisers the API is configured with (`RECOGNITION_PROVIDERS` and keys from `apps/api/.env`). It also checks topic matching on the labelled request pairs in `v1/topic-pairs.json`. It runs weekly in `.github/workflows/benchmarks.yml` and writes `results/<time>.md` and `.json`. A failed gate exits non-zero and opens an issue.

Correction rate comes from what real learners did, not from the seed set: `pnpm --filter @sbi/api ops:recognition-corrections [days]` reads stored recognition results (kept 30 days) and reports how many learners picked another option or typed their own name, among those who chose.

## Metrics and thresholds (spec §13 "Recognition")

| Metric             | Meaning                                                                                                                            | Threshold |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `top1Accuracy`     | The first candidate names the object, over photos that have one                                                                    | ≥ 0.75    |
| `top3Accuracy`     | Any of the three candidates names it                                                                                               | ≥ 0.90    |
| `ece`              | Calibration: expected gap between the model's stated confidence and how often its first candidate is right (5 reliability bins)    | ≤ 0.15    |
| `abstentionRecall` | Photos that should be held back (ambiguous or unsupported) that were: not a confident "recognised" with a "likely" first candidate | ≥ 0.90    |
| `falseReuseRate`   | Pairs that ask different things but would share one lesson (production `buildIntentSignature`)                                     | = 0       |

Also reported, not gated:

- abstention precision;
- topic-matching precision and recall;
- results by condition, using the seed tags (`ambiguous-photo`, `high-risk`, `unsupported`, or `clear-photo` when untagged).

Reuse recall is low by design: only near-identical requests share a lesson, so paraphrases get a fresh one. A false reuse would show a learner the answer to someone else's question, so it must stay at zero.

## First run (2026-11-04)

See `results/2026-11-04T13-22-09.md`. The gate **fails** on abstention and on one error:

- **top-1 0.91, top-3 0.97, ECE 0.02.** Confidence tracks accuracy closely, and calibration is still the identity map (`uncalibrated-v0`).
- **Abstention recall 0.67.** "What is in this glass?" (seed-027, a clear liquid) and the abstract painting (seed-037) were named confidently instead of held back. The recogniser's prompt already lists "a clear liquid" as ambiguous, so this belongs to recognition, not to the threshold.
- **seed-007's photo changed upstream.** The Wikimedia file no longer matches its recorded hash, so it was skipped and counted as an error. The seed set needs a replacement image in v3.
- **Topic matching:** precision 1, recall 0.15, no false reuses.
- **Correction rate** on the development database (the owner's own testing, not learners): 50 results, 14 with a choice, 4 corrected (29%), 2 by picking another option and 2 by typing a name. Measure it on real learners once there are some.
- The `misconception` and `paraphrase` rows in the condition table are question tags, not image conditions. Real-world image conditions (low light, clutter, partial view) need tagged photos in the next seed set.
