# 0024. Next concepts come from the concept graph, and are measured without tracking learners

- Status: accepted
- Date: 2026-11-03
- Issue: #106

## Context

Spec §5 "Go further" wants related concepts without optimising for shallow clicks. Ranking by what people click would reward the most clickable topic, not the most useful next idea. The event pipeline (#76) isn't built yet.

## Decision

- **Suggestions come only from the concept graph** (`relatedConcepts` in `@sbi/orchestrator`). Catalogue objects are linked to the concepts they teach, including concepts inherited from their category, and to their category.
  - Objects that share a concept with the lesson come first, most shared first, then objects in the same family.
  - Ties are broken alphabetically, so the list is the same for everyone.
  - Lessons on subjects outside the catalogue use their own concepts.
- **No click data feeds the ranking.** `GET /lessons/related` uses only the lesson and the taxonomy.
- **Following a suggestion is measured** with `POST /events/next-concept`, which records the lesson, the suggestion and its rank, with no learner, session or IP. That's enough to judge the list, and nothing about who clicked.
  - The event is a typed `NextConceptEvent` in `@sbi/analytics`, written as a structured log line until #76 builds the pipeline (`TODO(#76)`).
  - It's rate-limited per client.
- **Shown after every lesson**, because the five-phase lessons have no "Go further" module.

## Consequences

- Better suggestions need better concept data in the catalogue (#109), not a ranking model.
- Event counts live in logs for now, under their 30-day retention, until #76.
