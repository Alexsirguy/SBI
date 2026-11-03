# 0023. Learner pathways: chosen, never inferred, with a grown-up check for children

- Status: accepted
- Date: 2026-11-03
- Issue: #108

## Context

Spec §2 and §14 want a distinct tone and distinct controls for adults and children. The age band (#63) was already the learner's own choice, and we never guess age (ADR 0018, #331). Nothing stopped a child moving their own band to Adult, keeping a photo, or opening a link that asked for adult lessons.

## Decision

- **Two pathways, picked by a person.** The capture page asks "Who's learning?" once: "I'm learning for myself" or "A child is learning". You can change it later in "Your choices". No age, photo or text is used to guess the answer.
- **Stored in a cookie (`sbi_pathway`), not browser storage,** so the server enforces it. In the child pathway the lesson page always asks for the child band, whatever the URL says. The tone follows from the band: the child-band prompt rules and safe-activity rules already apply.
- **Adult-aware controls.** In the child pathway, these need a grown-up check first:
  - changing the age band;
  - the "I'm an adult: change age band" button on a held question;
  - keeping a photo;
  - leaving the child pathway.
- **The grown-up check is a times-table question** (6–9 × 6–9), new after each wrong answer. It is a speed bump that asks for a grown-up's attention. It does not verify identity or age, and we don't claim that it does.
- **Accounts stay 13+ (ADR 0020).** The child pathway doesn't change that.

## Consequences

- A determined child can still pass the check or clear cookies. Like the age band, this guides; it doesn't police.
- Shared devices keep the last choice until someone changes it, which errs towards the child setting.
