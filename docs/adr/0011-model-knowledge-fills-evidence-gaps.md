# 0011. Fill evidence gaps from model knowledge, with one disclaimer

- Status: accepted
- Date: 2026-10-30
- Issue: #233
- Amends: 0010; the goal of epic #42

## Context

Request-time evidence often leaves gaps:

- some sub-questions find no open source that covers them (#224, #231);
- history is rarely covered;
- some objects find nothing at all.

Under ADR 0010, a lesson with no evidence answered 404. Optional modules were written only when claims supported them, so a lesson's shape changed with whatever evidence turned up.

The product owner decided that a lesson must never be held back, or have its structure changed, because evidence is missing. Where sources are missing, the AI answers from its own knowledge, and the lesson says so. This applies to every topic, high-risk included. The learner sees one lesson-level disclaimer rather than per-section marks.

## Decision

**Claims from model knowledge**

- `Claim.origin` is `evidence` (absent means evidence) or `model`.
- A model claim has no sources, keeps status `unsupported`, and carries the note "From the AI's general knowledge; not yet checked against a source."
- Model claims are never stored in the claim graph and never verified by the judge.

**When model claims are used**

- After gathering, model claims are generated (prompt `model-knowledge-p0.1`) for:
  - each sub-question with no teachable claim;
  - history, when no history sub-question was answered;
  - the learner's whole question, when nothing was gathered and no taxonomy fact exists.
- Checked evidence always comes first. At most 12 model claims are added, without crowding out evidence.

**Lesson structure**

- From lesson-draft v6, every lesson has all eight modules: what-youre-seeing, short-answer, first-principles, how-parts-work, try-an-idea, history, check-thinking, go-further.
- Thin claims make a section shorter, not absent.
- Model claims are taught plainly, never as open questions.
- `try-an-idea` is a thought experiment or everyday observation. On high-risk topics it is a thought experiment only.

**Checks still apply**

- Every section must cite a claim, and the entailment judge checks it against its claims, model claims included.
- Only excerpt resolution and the two-source policy skip model claims, because they have no excerpt.

**Routing**

- Any model claim sends the lesson to `disclose`, as `needs-review`, with one `model-knowledge` disclaimer: "Parts of this lesson come from the AI's general knowledge because no trusted source was found for them, and no reviewer has checked it yet. Report anything that looks wrong."
- This disclaimer replaces "awaiting review" and is not repeated as open-questions or limited-evidence notes.
- On high-risk topics the safety notice still comes first.
- Disclosed lessons are never reused from the cache or served as fallbacks.

**404 now** happens only when even model knowledge offers nothing.

## Consequences

- Every lesson has the same shape. No question goes unanswered because sources are missing.
- Epic #42's goal changes, from "every displayed factual claim traces to a real stored source excerpt" to "every displayed factual claim either traces to a stored excerpt or is disclosed as unsourced model knowledge".
- More lessons are served before review. Because history is rarely sourced, most lessons will carry the model-knowledge disclaimer until sources widen (#231).
- Unsourced statements on high-risk topics reach learners, under the safety notice, the conceptual-only rule and the disclaimer. This should be the safety owner's first review item (#66).
- A wrong model claim is not caught by evidence. Only the entailment judge (consistency with itself), the contradiction check, and reviewers stand between it and the learner.
