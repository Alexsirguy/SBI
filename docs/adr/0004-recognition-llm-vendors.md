# 0004. Recognition and LLM vendors

- Status: proposed (selection pending the first benchmark run)
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

## Decision

Pending the first benchmark run. The proposed rule:

1. **Primary:** `meta-spark` in Standard mode, if it reaches at least 85% top-3 recognition, at least 90% lesson-contract validity and 100% safe handling of high-risk prompts, with p95 recognition latency under 6 s.
2. **Fallback:** the better-scoring OpenAI model, used automatically when Meta errors or times out, behind the same `LlmProvider` interface.
3. Never use contributor-mode models for learner content. `PROVIDERS` in `@sbi/benchmark` excludes them.

Results land in `docs/research/benchmark/` and this ADR is updated with the numbers and the final choice.

## Consequences

- Switching vendor is a config change, because both sit behind `LlmProvider`.
- Before production, Meta's Standard-mode retention terms must be confirmed in writing. Until then, photos sent to either vendor are evaluation data only, never learner photos.
- Self-hosting the open-weight Muse Spark Open stays an option if retention or region terms turn out unacceptable.
