# Phase 0 go/no-go report

- Date: 2026-10-27 (updated after the vendor run and model spikes; learner sessions still to come)
- Issue: #16, epic #9
- Gate (§14): learners explain a mechanism they chose more clearly, and the evidence, safety, caching and rights workflows are shown to be feasible.

## Summary

| Gate item                          | Status                   | Evidence so far                                                                                                                                                                    |
| ---------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Learners explain more clearly      | **Pending**              | Prototype, pre/post check and explain-back are ready (#12–#14). Learner sessions not yet run.                                                                                      |
| Evidence retrieval and claim graph | **Feasible, with fixes** | 10 of 12 real claims were automatically supported by their cited source, and the false control was rejected. One miss was a real authoring error; the other was a retrieval limit. |
| Safety classification              | **Feasible**             | Rules: 5 of 5 risky caught, 0 of 35 benign blocked. Meta Spark classifier: 5 of 5 risky handled safely, 38 of 40 exact, 2 cautious redirects on vague prompts.                     |
| Intent-signature cache             | **Feasible**             | Meta Spark intent classifier: precision 100%, recall 100% on 19 pairs (keywords alone: 100% / 80%). Misses fall back to generating, which is safe.                                 |
| Rights workflow                    | **Feasible**             | 38 of 38 seed images have complete records. 34 can be published with attribution; 4 (GFDL or FAL) are internal-only. Prototype assets are all project-owned or OFL/MIT.            |
| Vendor selection (#15)             | **Decided**              | ADR 0006: Meta Spark primary, GPT-5.4-mini fallback, Meta Wonder rejected. Recognition latency (p95 17 s) misses the 6 s target and must be fixed in Phase 1.                      |

**Current recommendation: conditional go.** The evidence, safety, caching and rights workflows are feasible, and the vendors are chosen. The remaining condition is the primary gate measure: the learner sessions. Two engineering risks carry into Phase 1:

- recognition latency
- table-aware evidence extraction.

## Evidence spike

Run `2026-10-27T15-13-58.json`. Live Wikipedia retrieval, with records validated against the `EvidenceSource` and `Claim` contracts. All 13 records were contract-valid.

| Topic           | Claims | Supported | Notes                                                                                                                                                                    |
| --------------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bicycle gearing | 4      | 4         | Including the Rover (1885) and penny-farthing direct drive.                                                                                                              |
| Boiling water   | 4      | 3         | `k5` (about 2,260 kJ/kg) missed: the figure (2257) is in a table, which the plain-text extract drops. **Retrieval needs table-aware parsing.**                           |
| Photosynthesis  | 4      | 3         | `l9` missed: the cited article supports Ingenhousz (1779) but gives no year for Priestley. **The prototype lesson gave 1771 without a supporting source; fixed in #13.** |
| Control (false) | 1      | 0         | Correctly unsupported, recorded as an `unsupported` claim with an uncertainty note.                                                                                      |

What this shows:

- Simple term-matching verification already catches unsupported specifics, such as dates and numbers.
- Production needs table-aware extraction and an entailment check (an LLM judge over the excerpt), not just term matching.
- Claims that fail verification can be stored as `unsupported` with an uncertainty note, which the `Lesson` contract already requires.

## Safety spike

| Classifier                 | Risky handled safely | Benign over-blocked | Notes                                                                                        |
| -------------------------- | -------------------- | ------------------- | -------------------------------------------------------------------------------------------- |
| Rules (`SAFETY_RULES`)     | 5 / 5                | 0 / 35              | Medicine, foraging, mixing chemicals, sockets, predictions                                   |
| Model (`--llm meta-spark`) | 5 / 5                | 2 / 35 redirected   | `seed-037` (abstract painting) and `seed-039` (blurry photo); run `2026-10-27T16-09-39.json` |

The rules were written knowing the seed set, so 5 of 5 is an upper bound, not evidence of robustness. The design is two layers: rules as a cheap first pass, then the model classifier for everything that passes. Phase 1 needs a held-out set of high-risk prompts (paraphrases, misspellings, indirect wording) before either layer can be trusted.

## Intent-cache spike

| Classifier | Pairs | Correct reuse | Wrong reuse | Missed reuse | Precision | Recall |
| ---------- | ----- | ------------- | ----------- | ------------ | --------- | ------ |
| Keywords   | 19    | 8             | 0           | 2            | 100%      | 80%    |
| Model      | 19    | 10            | 0           | 0            | 100%      | 100%   |

- The model classifier (Meta Spark, run `2026-10-27T16-09-39.json`) matched both held-out paraphrases that keywords missed, with no wrong reuse.
- Both keyword misses are held-out paraphrases with no shared keywords ("sprockets at the back", "big blobs rising in my kettle"). Missing a match is the safe direction: the lesson is generated fresh.
- A wrong reuse would show a learner a lesson for a different question, so precision is the bar.
- Audience is part of the signature, so a child and an adult asking the same thing get separate entries, matching the `LessonReuse.matchDimensions` design.

## Rights spike

- **Records:** 38 of 38 seed images have the source page, author, licence and a pinned SHA-256.
- **Licences:**
  - CC BY-SA (various versions): 24
  - Public domain or CC0: 6
  - CC BY: 4
  - GFDL 1.2: 3
  - FAL: 1
- **Internal-only:** `seed-002`, `seed-011`, `seed-029` and `seed-035` (GFDL or FAL) must not be republished without review.
- **Prototype assets** are project-owned (SVG illustrations, `gears.glb`) or OFL/MIT (fonts, Three.js), recorded in `design/prototype/CREDITS.md`.

- **Gap found by the vendor run:** `seed-006` (swing) has a complete rights record but shows a child's face. Every model refused it, which is the correct behaviour. The rights record didn't catch it, so the register needs a people/faces check alongside the licence fields. Seed set 2.0.0 replaces it, along with two illustrations (feather, cactus), and adds a `peopleVisible` field to every image, enforced by a test.

The rights workflow works as a manual register. `@sbi/rights` should enforce the same rule automatically: no publication without a complete record and a publishable licence.

## Before the final verdict

- [ ] Hold the learner sessions (#11–#14), then fill in the synthesis and usability findings.
- [x] Do the vendor benchmark run (#15), then update ADR 0006.
- [x] Run `spikes --llm meta-spark`, then fill in the pending rows above.
- [x] Move lessons to first principles (short answer, then steps that derive it, with guesses) in the prototype and `lesson-p0.2`; re-run lessons (Meta Spark 100% valid and deriving the answer, p50 17.0 s).
- [ ] Score the `2026-10-27T18-44-40` lesson rubric CSV by hand (accuracy, age fit, reasoning sound, misconception handled).
- [x] Seed set 2.0.0: replace the `seed-006`, `seed-008` and `seed-022` photos and add the alias "electrical outlet"; then re-run recognition (Meta Spark 100% top-3, GPT-5.4-mini 92%).
- [ ] Re-run the evidence spike after adding table-aware extraction.
