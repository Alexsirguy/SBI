# 0021. Learners share lessons one at a time, into review

- Status: accepted
- Date: 2026-11-03
- Issue: #104

## Context

Spec §3 lets learners share a reusable lesson with provenance, as an opt-in. Reuse (#52) only serves shared, validated lessons. Until now nothing was ever shared, so reuse never matched anything. A learner's lesson came from their question, and the assumptions they gave describe their own situation.

## Decision

- **Sharing is an action on one saved lesson, not a standing setting.** The share box says what goes (a copy of the lesson) and what never goes (name, photo, the learner's own words). It asks only when the learner chooses that lesson. So it isn't one of ADR 0019's consent purposes, which cover ongoing uses.
- **The copy is anonymous.** `shareLesson` in `@sbi/orchestrator`:
  - gives it a new id and version 1;
  - drops the learner's assumptions;
  - redacts email addresses and phone numbers anywhere in the text;
  - recomputes the content hash.
    The intent signature stays, because it is a hash and is what lets a similar question find the lesson.
- **Provenance is kept.** The copy keeps its evidence snapshot, source freshness and model, prompt and policy versions. `lastUserConfirmationAt` records when the learner shared it. The review trail says which lesson and version it came from.
- **Review comes first.** The copy enters as `needs-review` through `transitionLesson`, and reuse serves only validated lessons. So nobody else sees it until a reviewer approves it.
- **Once per lesson.** The saved lesson records `shared_at`, and sharing again is refused.

## Consequences

- Deleting an account doesn't delete lessons it shared. The copies hold nothing about the learner, and the privacy page and share box say so.
- A shared copy can't be withdrawn yet. Reviewers can reject it before anyone sees it.
- Reviewers now have a queue fed by learners. Capacity is part of the Phase 4 review (#110).
