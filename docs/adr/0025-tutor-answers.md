# 0025. The tutor answers from the lesson first, briefly, and changes the visual instead of lecturing

- Status: accepted
- Date: 2026-11-03
- Issue: #93
- Builds on: 0011, 0014, 0019, 0020

## Context

Spec §8 asks for a tutor grounded in the current lesson's evidence, with safe fallbacks. Learners ask two kinds of question: why the playground did what it did, and things the lesson never covers. Issue #95 first said the tutor should decline unsupported questions and offer a research path. Lessons already answer gaps from model knowledge with one disclaimer (ADR 0011), and a tutor that declines everyday follow-ups would feel like the over-refusal fixed in #331.

## Decision

**What it answers from (owner's choice)**

- The lesson's own claims come first. A reply cites the claim IDs it used, and may only cite claims retrieved for that turn.
- A question the lesson doesn't cover is answered from model knowledge, uncited, with one short note that it goes beyond the lesson's sources. This replaces #95's research path.
- The tutor never describes details of the learner's photo that recognition didn't detect.
- It refuses only for safety, using `@sbi/safety` policies and age holds, and redirects to the concept behind the question.
- It asks one clarifying question only when a question can't be answered as asked.

**How it answers (owner's choice)**

- Replies are short: two or three sentences, in the lesson's language and at its depth.
- Where showing helps, a reply carries one visual action: set sliders, step to a demonstration step, or highlight a label.
- Actions are checked against the visual's manifest and the lesson's steps; an unknown control, value, step or label is dropped. The tutor changes the existing visual and never generates a new one.
- The whole reply is validated before it is shown, so replies are returned as JSON, not streamed.

**What is kept (owner's choice)**

- Signed-in learners keep each lesson's conversation for 30 days (`account` retention class), included in account export and delete.
- Signed-out learners, including under-13s who can't have accounts, get a conversation per visit (`session` class, 24 hours).
- Reset clears a lesson's conversation at any time.
- The `quality-review` and `research-consented` classes stay unused until their consent wording is reviewed and `CONSENT_VERSION` is bumped (ADR 0019).

**Release**

- The `tutor` feature flag stays off until the held-out evaluation (#100) meets its thresholds.

## Consequences

- Off-lesson answers aren't checked against sources, so the disclaimer must always show when nothing is cited.
- Visuals need small public hooks for step and highlight, which they lack today.
- Tutor turns become account data, so export, delete and the retention table change with #99.
