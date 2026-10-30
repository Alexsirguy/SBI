# 0010. Disclose doubts on lessons instead of holding them

- Status: accepted
- Date: 2026-10-30
- Issue: #211

## Context

Lessons built from request-time evidence often fail one automated check:

- a section says a little more than its cited claims;
- sources disagree;
- a claim rests on one source.

The spec (§7) routes high-risk or low-confidence lessons to human review, and (§10) forbids returning "an unreviewed answer as if it passed the evidence gate". Until review tooling exists, holding every such lesson means most learners get nothing. The owner chose to serve these lessons with clear disclaimers, including on high-risk topics, where the disclaimer must be stronger and safety-specific.

## Decision

`routeLesson` now has three outcomes:

| Outcome         | When                                                                                                                                      | What the learner gets                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `approve`       | Every check passed; normal topic                                                                                                          | The lesson, `auto-validated`                   |
| `disclose`      | Failed entailment, contradiction, misconception or reading-level checks; low-confidence, disputed or open claims; **any high-risk topic** | The lesson, `needs-review`, with `disclaimers` |
| `review` (hold) | Failed schema, citation or evidence checks, or an unknown check; visual rights not cleared                                                | No lesson; a cached fallback or a clear retry  |

**Integrity failures are still held.** These are a citation to a claim that does not exist, text that differs from the stored claim, a source that changed or vanished, or a factual section with no citation. A disclaimer cannot make a lesson truthful about where its statements come from.

**Disclaimers** (`LessonDisclaimer`):

- Each has a kind, a plain message and the sections it applies to.
- Disclosed lessons always say a reviewer has not checked them yet.
- They stay `needs-review` in the reviewer queue, and are never reused from the cache or used as a fallback.

**High-risk topics** (medicines, cleaning products and other household chemicals, electrical sockets, wild mushrooms):

- A topic-specific **safety** disclaimer comes first. It says the lesson explains the science only and is not advice on using, handling, dosing or eating, and gives the emergency step for that topic. The quick answer carries the same notice, and no answer streams early on these topics.
- Planning and drafting are constrained to concepts: lesson-draft v3 forbids steps, amounts or tips for preparing, mixing, using, dosing, eating, handling, testing or repairing.

## Consequences

- Far more questions get a lesson. Doubts are visible instead of silent.
- Learners may read unreviewed material. The disclaimers, the review queue and the "report a problem" path (spec §7) carry that risk; review tooling should prioritise disclosed high-risk lessons.
- The safety classifier (#67) should replace the hard-coded high-risk list, and the notices should be reviewed by the safety owner (#66).
