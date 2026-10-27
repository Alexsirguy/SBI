# Phase 0 go/no-go report

- Date: 2026-10-27 (first draft; update after the API runs and learner sessions)
- Issue: #16, epic #9
- Gate (§14): learners explain a mechanism they chose more clearly, and the evidence, safety, caching and rights workflows are shown to be feasible.

## Summary

| Gate item                          | Status                   | Evidence so far                                                                                                                                                                    |
| ---------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Learners explain more clearly      | **Pending**              | Prototype, pre/post check and explain-back are ready (#12–#14). Learner sessions not yet run.                                                                                      |
| Evidence retrieval and claim graph | **Feasible, with fixes** | 10 of 12 real claims were automatically supported by their cited source, and the false control was rejected. One miss was a real authoring error; the other was a retrieval limit. |
| Safety classification              | **Feasible (baseline)**  | Rules caught 5 of 5 risky seed prompts with no false blocks on 35 benign ones. The model classifier is still to run.                                                               |
| Intent-signature cache             | **Feasible**             | Keyword signatures: precision 100%, recall 80% on 19 pairs; misses fall back to generating, which is safe. The model classifier is still to run.                                   |
| Rights workflow                    | **Feasible**             | 38 of 38 seed images have complete records. 34 can be published with attribution; 4 (GFDL or FAL) are internal-only. Prototype assets are all project-owned or OFL/MIT.            |
| Vendor selection (#15)             | **Pending**              | Harness ready; needs a run with Meta and OpenAI keys.                                                                                                                              |

**Current recommendation: conditional go.** The workflows look buildable. Phase 1 should not start until the two pending items have real numbers:

- the learner sessions, for the primary gate measure
- the vendor run, for model safety and cache behaviour.

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

| Classifier                 | Risky handled safely | Benign over-blocked | Notes                                                       |
| -------------------------- | -------------------- | ------------------- | ----------------------------------------------------------- |
| Rules (`SAFETY_RULES`)     | 5 / 5                | 0 / 35              | Medicine, foraging, mixing chemicals, sockets, predictions  |
| Model (`--llm meta-spark`) | pending              | pending             | Runs the benchmark's safety prompt over all 40 seed prompts |

The rules were written knowing the seed set, so 5 of 5 is an upper bound, not evidence of robustness. The design is two layers: rules as a cheap first pass, then the model classifier for everything that passes. Phase 1 needs a held-out set of high-risk prompts (paraphrases, misspellings, indirect wording) before either layer can be trusted.

## Intent-cache spike

| Classifier | Pairs | Correct reuse | Wrong reuse | Missed reuse | Precision | Recall  |
| ---------- | ----- | ------------- | ----------- | ------------ | --------- | ------- |
| Keywords   | 19    | 8             | 0           | 2            | 100%      | 80%     |
| Model      | 19    | pending       | pending     | pending      | pending   | pending |

- Both misses are held-out paraphrases with no shared keywords ("sprockets at the back", "big blobs rising in my kettle"). Missing a match is the safe direction: the lesson is generated fresh.
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

The rights workflow works as a manual register. `@sbi/rights` should enforce the same rule automatically: no publication without a complete record and a publishable licence.

## Before the final verdict

- [ ] Hold the learner sessions (#11–#14), then fill in the synthesis and usability findings.
- [ ] Do the vendor benchmark run (#15), then update ADR 0006.
- [ ] Run `spikes --llm meta-spark`, then fill in the pending rows above.
- [ ] Re-run the evidence spike after adding table-aware extraction.
