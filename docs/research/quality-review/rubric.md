# Scientific quality review: rubric `quality-review-v1` (#80)

Spec §13 asks for "expert factuality review, claim-source entailment, outdated-source detection, uncertainty calibration and error severity". The automated parts run every week (#78: entailment, key facts, reading level, harm) and every day (the freshness pass). This rubric is the human part: a subject expert reads a lesson the way a learner would, then checks it against its sources.

Reviews are recorded as `LessonReview` (`@sbi/evidence`, `review/rubric.ts`). Bump `RUBRIC_VERSION` whenever a criterion, scale or category below changes, and never compare scores across versions.

## Before you start

- Review one lesson version: the `lessonId` and `version` from the sample (`sampling-plan.md`). Open it with its sources expanded.
- Read the whole lesson first as a learner of its audience band, then go claim by claim.
- Record each problem as a finding with a category and a severity, pointing at the claim or section. Short notes are fine.

## Scores, 1–4 for each

| Criterion       | 4                                                               | 3                                                  | 2                                                                | 1                                                 |
| --------------- | --------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------- |
| **Accuracy**    | Every statement is correct for the stated scope.                | Correct; minor imprecision a teacher would let go. | One or more statements a teacher would correct.                  | Teaches something wrong about the core mechanism. |
| **Evidence**    | Each claim's sources say what the claim says, and are suitable. | Sources support the claims, one or two loosely.    | Several claims go beyond, or misread, their sources.             | Sources don't support the core claims.            |
| **Uncertainty** | Confidence and caveats match the state of the science.          | Mostly matched; a caveat missing or extra.         | States contested or uncertain things as settled, or the reverse. | Presents speculation as fact on the main point.   |
| **Clarity**     | Right for its audience band; the mechanism is easy to follow.   | Clear, with a step or word that will trip some.    | Hard to follow for its band.                                     | Confusing enough to mislead.                      |

## Finding categories

`factual-error`, `unsupported-claim` (true or not, the sources don't back it), `citation-mismatch` (it cites the wrong source or excerpt), `outdated-source` (superseded, retracted or changed), `overstated-certainty`, `misleading-simplification`, `unsafe-suggestion`.

## Error severity scale

| Severity     | Meaning                                                                                               | Examples                                                                                                          | What happens                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **critical** | A learner who trusts it would believe something false about the core idea, or could be harmed.        | Wrong mechanism; a reversed causal claim; an unsafe activity for a child; a retracted source as the main support. | The lesson is corrected or withdrawn before it's served again (`needsCorrection`). Counts against the phase gate. |
| **major**    | Wrong or unsupported, but not the core idea; or right but resting on unsuitable or outdated evidence. | A wrong figure in an aside; a claim its excerpt doesn't support; overstated certainty on a side point.            | Corrected in the next revision; tracked per lesson.                                                               |
| **minor**    | Imprecise wording, a missing caveat, or a simplification an expert would phrase better.               | "Heat rises" instead of "hot air rises"; a missing "usually".                                                     | Collected for prompt and style improvements.                                                                      |

The Phase gate (epic #75) needs "no unresolved critical factual or licensing issues": every critical finding must be fixed or the lesson withdrawn, and recorded as such.

## After the review

- Enter the review in `review-sheet.csv` (one row per finding, plus one row of scores per lesson), or as `LessonReview` JSON.
- Critical findings go through the correction pathway straight away.
- `summariseReviews` reports errors per lesson by severity, mean scores and findings by category. Report them per audience band and topic family, with the sample size.
