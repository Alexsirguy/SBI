# Learning signal: concept check and clarity (#81)

Spec §1 asks whether concepts become clearer, measured by a "pre/post one-question concept check and learner-rated clarity", with "positive directional gain; no launch claim until instrument validated". This is the instrument, how to read it, and what has to happen before anyone cites it.

## Instrument `concept-check-v1`

| Part        | What the learner sees                                                                                                      | Event                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Before**  | The lesson's opening guess (Merrill's activate step): one multiple-choice question, answered before the demonstration.     | `concept_check_answered` with `phase: "pre"`  |
| **After**   | "Now what do you think?" at the end of the lesson: the same question, options in reverse order, answered after the lesson. | `concept_check_answered` with `phase: "post"` |
| **Clarity** | "How clear was it?" 1–5 in the lesson's feedback card (with "How helpful?").                                               | `lesson_rated` with `clear` and `helpful`     |

Every concept-check event carries:

- `lessonId`, `version` and `itemId` (the task's id);
- `instrument: "concept-check-v1"`;
- `correct`: the response class;
- `explanationOpened`;
- `topic`.

The usual context comes with it: age band, locale, device tier and consent version.

- **`explanationOpened`:** for the after answer, whether the guess's explanation ("Back to your guess", which states the answer) had been half on screen before answering. It's always `false` for the before answer.
- **`topic`:** a catalogue taxonomy id, or `subject` for typed subjects, whose ids are made from the learner's own words.
- **Who is counted:** answers are sent only with the usage-statistics consent, and never for under-13s (ADR 0026), so the sample is consenting learners aged 13 and over.
- **Bump `CONCEPT_CHECK`** (`apps/web/app/analytics/concept-check.ts`) whenever the wording, placement, option order or scoring changes. Never compare across versions.

## Known weaknesses of v1

- **The answer is shown before the after question.** The demonstration ends by revealing the answer, so a correct after answer can be recall of that reveal rather than understanding. Split results by `explanationOpened`. A gain only among learners who never saw the reveal is the more meaningful number.
- **Same item, same options.** A learner may remember their own earlier choice. Reversing the option order removes position memory, not content memory.
- **Lessons only have a guess when they follow the Merrill shape.** Other lessons send no concept check.
- **Self-selection.** Learners who reach the end of a lesson differ from those who stop. Report the before-answer count next to the after-answer count.

## Reporting, per topic and age band (Mixpanel)

1. **Insights → `concept_check_answered`:**
   - Filter `instrument = concept-check-v1`.
   - Break down by `phase`, then `correct`.
   - Group by `topic`, then `ageBand`.
2. **Directional gain per topic:** share correct after minus share correct before, within the same topic and age band. Show the n for each phase.
3. **Paired gain:** a funnel `concept_check_answered (pre)` → `concept_check_answered (post)` on the same `distinct_id` (one visit) and `lessonId`, broken down by the first step's `correct` then the second's. It gives wrong→right, right→right, right→wrong and wrong→wrong per topic.
4. **Clarity:** average `clear` on `lesson_rated`, by `topic` and `ageBand`.

Never report a single "learning score". Say it's a directional signal from a self-selected, consenting 13+ sample.

## Validation plan (before any claim)

1. **Item review:**
   - A subject reviewer checks a stratified sample of 30 generated guesses: is there one defensible answer, is it the one the lesson teaches, and are the distractors plausible misconceptions?
   - Record pass rates in `docs/research/learning-signal/item-review-v1.md`.
2. **Think-aloud with learners:**
   - In consented usability sessions (`docs/research/usability/`), learners explain their after answer.
   - Code whether a correct after answer reflects the mechanism or only the revealed answer.
3. **Agreement with an explanation-back task:**
   - In the pilot (spec §13 "Learning"), compare the after answer with a short explanation scored by a rubric.
   - The instrument is usable only if correct after answers predict adequate explanations better than chance, per age band.
4. **Decide v2:** if recall dominates, move the after question before the reveal, or generate a parallel item for it, and bump to `concept-check-v2`.
