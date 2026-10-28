# 0006. Recognition and LLM vendors

- Status: accepted for Phase 0 (production use depends on Meta confirming its retention terms)
- Date: 2026-10-27
- Issue: #15

## Context

Photo recognition and lesson generation (§6) both need a vision-capable language model. We want vendors chosen on accuracy, cost, privacy and latency before contracting (§17). The preferred primary vendor is Meta. OpenAI is the comparison and fallback candidate.

Both vendors expose an OpenAI-compatible Chat Completions API with image input as base64 data URLs and JSON-schema structured output. So one adapter (`createOpenAiCompatibleProvider` in `@sbi/llm`) serves both. Recognition is a vision-LLM recogniser in `@sbi/recognition` that takes any `LlmProvider`.

Candidates benchmarked by `@sbi/benchmark` on seed set 1.0.0 (#10):

| Id            | Vendor | Model             | Role                  | Price per 1M tokens (in / cached / out) |
| ------------- | ------ | ----------------- | --------------------- | --------------------------------------- |
| `meta-spark`  | Meta   | `muse-spark-1.3`  | Primary candidate     | $1.25 / $0.15 / $4.25                   |
| `meta-wonder` | Meta   | `muse-wonder-1.0` | Higher-quality option | $4.00 / $0.20 / $20.00                  |
| `openai-main` | OpenAI | `gpt-5.4`         | Fallback candidate    | $2.50 / $0.25 / $15.00 (verify)         |
| `openai-mini` | OpenAI | `gpt-5.4-mini`    | Low-cost fallback     | $0.75 / $0.075 / $4.50 (verify)         |

Meta prices are from the [Meta pricing page](https://dev.meta.ai/docs/pricing-rate-limits). OpenAI prices come from third-party aggregators and must be confirmed on [openai.com/api/pricing](https://openai.com/api/pricing). Run `bench --check-models` to confirm each model id exists for our keys.

## Privacy review

| Question                | Meta Model API                                                                                                                                                                                                                      | OpenAI API                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Training on our content | Not in Standard mode. Contributor mode (`*-contributor` models, Muse Code subscriptions by default) **does** train on content. ([models](https://dev.meta.ai/docs/models), [pricing](https://dev.meta.ai/docs/pricing-rate-limits)) | Not by default for API data. ([your data](https://developers.openai.com/api/docs/guides/your-data))                     |
| Retention               | No retention period is published for Standard mode. Earlier Llama API terms allowed keeping flagged content for policy enforcement. **Open:** confirm in the signed-in terms before sending learner photos.                         | Abuse-monitoring logs are kept up to 30 days. Zero Data Retention and Modified Abuse Monitoring need OpenAI's approval. |
| Region                  | Availability varies by country (Geographic Use Policy); no data-residency option is documented.                                                                                                                                     | Per-project data residency (for example US or Europe) with approval.                                                    |
| Browser use             | CORS allows any origin, but Meta advises keeping keys out of client code.                                                                                                                                                           | Keys must stay server-side.                                                                                             |

## Results

Run [`2026-10-27T16-07-06`](../research/benchmark/2026-10-27T16-07-06.md): seed set 1.0.0, `reasoning_effort: low`, 6 requests in parallel across all providers. 448 calls, 1 error, $5.24 in total.

| Measure                                | meta-spark   | meta-wonder   | openai-main  | openai-mini  |
| -------------------------------------- | ------------ | ------------- | ------------ | ------------ |
| Recognition top-3 (36 labelled photos) | 92%          | 97%           | 94%          | 86%          |
| Recognition status correct (38 photos) | 90%          | 89%           | 84%          | 90%          |
| Recognition latency p50 / p95          | 6.1 / 17.1 s | 19.6 / 25.9 s | 5.9 / 10.8 s | 7.1 / 42.8 s |
| Lesson drafts valid against `Lesson`   | 100%         | 29%           | 100%         | 97%          |
| Lesson latency p50                     | 8.7 s        | 36.3 s        | 39.5 s       | 19.2 s       |
| Risky prompts handled safely           | 5 / 5        | 5 / 5         | 5 / 5        | 5 / 5        |
| Benign prompts over-refused            | 1 / 35       | 30 / 35       | 1 / 35       | 0 / 35       |
| Cost for the whole run                 | $0.65        | $2.67         | $1.54        | $0.38        |

Notes:

- Top-k is counted only over photos that have a right label. The run was rescored after fixing a plural bug in the label matcher ("oak leaves" didn't match "leaf").
- The remaining recognition misses are mostly seed-set problems, not model errors:
  - `seed-006` (swing) shows a child's face, so every model correctly answered "unsupported". The photo breaks the seed set's no-faces rule and must be replaced.
  - `seed-008` (feather) is an illustrated plate, and "educational poster" is a fair answer.
  - `seed-009` was answered "electrical outlet", which isn't in the aliases.
- Meta Wonder refused 29 of 35 benign questions as "self-harm" and redirected 1 more (for example the bicycle gears question), and its lesson drafts often came back with empty required arrays. At `reasoning_effort: low` it isn't usable with these prompts.
- The single over-refusal for Spark and GPT-5.4 is the same prompt: `seed-037`, an abstract painting with the question "What is this a picture of?". Redirecting it is reasonable.
- After seed set 2.0.0 fixed those photos, a recognition-only re-run ([`2026-10-27T16-43-25`](../research/benchmark/2026-10-27T16-43-25.md)) gave Meta Spark 100% top-3 and 92% status-correct (p95 12.1 s), and GPT-5.4-mini 92% and 92% (p95 6.4 s).
- Lessons now teach from first principles (`lesson-p0.2`): the short answer, then steps that derive it, with guesses. A lesson-only re-run ([`2026-10-27T18-44-40`](../research/benchmark/2026-10-27T18-44-40.md), 68 calls, about $0.95) gave:
  - Meta Spark: 100% contract-valid and 100% deriving the answer, a median of 11 steps and 6 guesses. p50 latency is 17.0 s, up from 8.7 s, because the lessons are longer.
  - GPT-5.4-mini: 97% valid and 94% deriving the answer, at 12.9 s p50. Two lessons skipped "Put it together", and one cited a claim with no source.
- Guesses whose options don't answer the question, or whose marked answer is wrong, showed up in the demo. A judge script (GPT-5.4-mini, so no model marks its own work) now checks every guess. For Meta Spark:
  - `lesson-p0.2`: 5 of 189 guesses flagged, in 4 of 34 lessons. GPT-5.4-mini's own lessons had none.
  - `lesson-p0.3` ([`2026-10-27T19-43-15`](../research/benchmark/2026-10-27T19-43-15.md)) asked for the explanation before the options: 12 of 179 flagged, which is worse. Most of these were a wrong answer index.
  - `lesson-p0.4` ([`2026-10-27T19-47-15`](../research/benchmark/2026-10-27T19-47-15.md)) has the model write the correct and wrong answers as text, and code places them: 3 of 187 flagged. One was a judge false positive, and two had a "correct" answer that contradicted the model's own explanation. p50 latency was 14.9 s.
  - Live lessons should therefore check their guesses after generating them, and show any guess that fails as a plain explanation. The prototype does this.
- Lesson accuracy, age fit and whether the reasoning steps really lead to the answer still need human scoring in the rubric CSV. Use the `lesson-p0.4` rubric (`2026-10-27T19-47-15-rubric.csv`).

## Decision

1. **Primary: `meta-spark` (`muse-spark-1.3`, Standard mode).**
   - It meets the bar on recognition (92% top-3, against an 85% target), lesson validity (100%, against 90%) and safety (5 of 5 risky prompts).
   - It wrote the old one-block-per-module lessons fastest (8.7 s p50), and step lessons at 17.0 s p50, and costs about 40% of GPT-5.4. Lesson latency needs streaming, or a short answer sent ahead of the steps, before Phase 1.
2. **Fallback: `openai-mini` (`gpt-5.4-mini`).**
   - It has the best safety score (40 of 40 exact) and the lowest cost, and 97% of its lessons are valid. It's used automatically when Meta errors or times out, behind the same `LlmProvider` interface.
   - GPT-5.4 recognises photos slightly better but takes 39 s to write a lesson, which is too slow for a fallback.
3. **Rejected: `meta-wonder`,** because of over-refusal and invalid lessons. Revisit at a higher reasoning effort only if Spark's quality falls short.
4. **Never use contributor-mode models for learner content.** `PROVIDERS` excludes them.

**Not met:** the target of p95 recognition latency under 6 s. No provider reached it; Spark's p95 was 17 s. That may be partly from parallel load. Before Phase 1:

- re-measure with no parallel load
- try `reasoning_effort: "minimal"` and smaller photos
- show the top candidate first, as a streamed response.

## Consequences

- Switching vendor is a config change, because both sit behind `LlmProvider`.
- Before production, Meta's Standard-mode retention terms must be confirmed in writing. Until then, photos sent to either vendor are evaluation data only, never learner photos.
- Self-hosting the open-weight Muse Spark Open stays an option if retention or region terms turn out unacceptable.
- `createRecognitionProvider` in `@sbi/recognition` applies this decision: Spark then GPT-5.4-mini, each with its own timeout (`RECOGNITION_TIMEOUT_MS`, default 20 s). It refuses contributor models and `store: true`, and sends `store: false` to OpenAI.
