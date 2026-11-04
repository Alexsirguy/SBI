# Phase 4 gate: cost, moderation and scale

Spec §14 makes Phase 4 depend on an operational review: moderation capacity, cost controls, and rights coverage that holds up at scale. This page gives the reviewer the numbers and the plan. **Signing off is a person's decision** (as with the launch review, #74). The checklist at the end records it.

## 1. Cost per completed lesson

**How it's measured.** Every lesson that reaches the learner logs one `lesson-cost` event (`@sbi/analytics`, written by `LessonService`). The event holds:

- the lesson id and version;
- the outcome: `fresh`, `cached` (reused), `fallback`, `refused` (a safety or age hold) or `failed`;
- model calls, input, cached-input and output tokens;
- `costUsd`, if prices are configured.

It holds nothing from the question or the lesson text. The lesson model's provider is wrapped once (`scopedProvider` in `@sbi/llm`), and each lesson request runs in its own usage scope. So every call made for that request counts: the risk classifier, evidence planning and extraction, model knowledge, the draft, the checks, the repairs and the visuals. Refused and failed requests are recorded too, because they spent tokens.

**Turning on prices.** Set `LESSON_PRICE_INPUT_PER_MTOK`, `LESSON_PRICE_CACHED_INPUT_PER_MTOK` and `LESSON_PRICE_OUTPUT_PER_MTOK` (US dollars per million tokens) to the lesson model's current price. Without them, tokens are still logged and `costUsd` is `null`.

**Reading it.** Lesson cost stays in our own logs, because it carries no learner and never goes to Mixpanel (ADR 0026). The events are log lines tagged `Events`:

```sh
# average cost of a fresh lesson over the logs you have
grep '"type":"lesson-cost"' api.log | grep '"outcome":"fresh"' \
  | jq -s 'map(.costUsd) | add / length'
```

Report three numbers: mean `costUsd` for `fresh`, the share of lessons that are `cached`, and the blended mean. Reuse is the biggest cost lever: a reused lesson costs no model calls.

**Not counted:** recognition, which is billed per photo rather than per lesson, and question suggestions, which are a separate request. Add them from the recognition and `LessonLlm` telemetry if they matter at your volume.

## 2. Cost controls

| Control                                                                                     | Where                                   | Status                                |
| ------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------- |
| Reuse of validated lessons, private ones for their owner (#342)                             | `reuse.ts`                              | In place                              |
| Claim caps per lesson (30, of which at most 12 from the model)                              | `lesson.service.ts`                     | In place                              |
| Token caps per call (questions 2k, model knowledge 3k, repairs 4k) and low reasoning effort | `@sbi/orchestrator`, `lesson.module.ts` | In place                              |
| Evidence-gathering budget (`EVIDENCE_BUDGET_MS`) and re-check batch size                    | `env.ts`                                | In place                              |
| Per-client limits: questions, feedback, next-concept events, sign-in and email              | in-memory `createRateLimiter`           | In place, per process (#120)          |
| Per-client limit on **lesson generation** and **uploads**                                   | —                                       | **Missing**, tracked in #120          |
| Daily spend cap that switches to reuse-only when exceeded                                   | —                                       | **Missing**: recommended before scale |

**Recommendation.** Ship #120's shared limits, including lessons per client per hour, and add a daily spend cap built on the `lesson-cost` events once #76 can sum them, before opening Phase 4 widely.

## 3. Moderation

### Where review work comes from

| Source                                                                             | What a reviewer does                                  | Size it with                                                                     |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| Lessons served with disclaimers (ADR 0010) and lessons held for integrity failures | Approve, or reject with a reason (`transitionLesson`) | `pnpm --filter @sbi/api ops:review-queue` (`needs-review`)                       |
| Lessons learners shared (ADR 0021)                                                 | Check the anonymous copy before it can be reused      | the same queue; the review trail says "Shared by a learner"                      |
| Problem reports from lesson feedback                                               | Fix, reject or regenerate the lesson                  | `lesson_feedback` rows with a category                                           |
| Safety: harm-category questions and reports about unsafe content                   | Same-day look; adjust rules or the classifier         | feedback category; harm refusals aren't counted yet (add a typed event with #76) |
| Catalogue demand                                                                   | Add entries (`docs/catalogue.md`)                     | `pnpm --filter @sbi/api catalog:priorities`                                      |

**Today's queue (dev database, 2026-11-03):** 371 versions `needs-review`, 19 `auto-validated`. Most lessons that use model knowledge arrive here by design, so the queue grows with use, not with problems.

### Staffing model

Reviewer hours per week = (new `needs-review` versions per week × minutes per review + problem reports per week × minutes per report + safety items × minutes per item) ÷ 60.

Starting assumptions to replace with measured times after the first week of reviewing:

- a lesson review takes **6 minutes**: read, check the cited sources, approve or reject;
- a problem report takes **10 minutes**;
- a safety item takes **15 minutes**.

At 500 new lessons a week with 30% reused, about 350 need review: 35 hours a week, roughly one full-time reviewer. **Reuse reduces review as well as cost:** an approved lesson serves later learners without another review.

**Service levels to commit to:**

- safety reports looked at within **1 working day**;
- problem reports within **5 working days**;
- shared lessons within **10 working days** (nobody sees them until then).

Lessons with disclaimers are already live, so they have no deadline, only a backlog target.

**Gap:** there is no reviewer screen yet. Reviewing today means working against the database and `transitionLesson`. A reviewer UI needs its own issue before staffing above one person.

## 4. Sign-off

Signed by: ______________________ Date: ______________

- [ ] Lesson prices configured, and a week of `lesson-cost` events reviewed. Fresh mean $____, cached share ****%, blended mean $****.
- [ ] Monthly cost at the expected volume is within budget, or the spend cap is in place.
- [ ] #120 lesson and upload limits are live, or the risk of running without them is accepted in writing.
- [ ] A named reviewer, with hours matching the model above, and the service levels agreed.
- [ ] A reviewer tool is decided (issue raised), or the database workflow is accepted for now.
- [ ] Rights coverage at scale re-checked: every asset a lesson shows is cleared in the rights register (`@sbi/rights`).
