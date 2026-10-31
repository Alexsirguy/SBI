# 0016. Teach first, gather fewer sources in the background

- Status: accepted
- Date: 2026-10-31
- Issue: #309
- Amends: 0009 (search depth) and 0011 (when evidence is gathered)

## Context

A cold lesson took about three minutes. On 31 October 2026, kettle, swing and guitar lessons, fresh and three at once, arrived 184 to 194 s after the request. The API log showed where the time went:

- **Fetching:** each sub-question fetched up to 8 references one after another (16 to 46 s).
- **Index:** the first search after start-up spent about 20 s building the LibreTexts index.
- **Sub-questions:** there were 3 to 6, run 3 at a time.

Fewer sources fetched in parallel under a 25 s budget brought lessons down to 56 to 73 s, but **verified no claims at all**. LibreTexts sets `Crawl-delay: 5`, and ADR 0009 says we honour it. Every sub-question's textbook pages share one queue spaced 5 s apart, and that queue alone outlasts any budget a learner would wait for. ADR 0011 already lets model knowledge fill any gap, so waiting for sources made lessons slow without making them possible.

## Decision

- **A lesson never waits for sources.**
  - If a stored evidence pack for the question is fresh (ADR 0011's rules), it is used at once. Its claims cite sources, and its early checked answer streams first.
  - Otherwise the lesson is drafted straight from model knowledge, with the model-knowledge disclaimer, and gathering starts in the background.
  - The finished pack is stored, so the next learner who asks gets a sourced lesson.
  - Only one background gather runs per pack.
- **Fewer sources per lesson:**
  - 2 or 3 sub-questions (were 3 to 6), all run at once.
  - Per sub-question: 2 open-textbook pages, 2 Wikipedia articles, 1 reference from each article, and at most 3 references in all (were 3, 4, 3 and 8).
  - Fetched in parallel. The polite fetcher still spaces requests to each host.
  - Source requests time out after 8 s and try twice (were 15 s and three tries).
  - A background gather stops after `EVIDENCE_BUDGET_MS`, 120 s by default.
- **Judging:** each claim is judged against 2 passages (was 3): its own source and the best other source. With one passage, no claim could ever reach `supported` or `disputed`.
- **Start-up:** the LibreTexts index starts building when the API starts.
- **Timing log:** each lesson logs one line with milliseconds to `gatheredMs`, `modelKnowledgeMs`, `draftedMs` and `checkedMs`.

## Consequences

**Measured on 31 October 2026, five at once:**

- **Cold lessons** arrived in 29 to 33 s. Of that, 4 to 6 s was model knowledge, about 8 s the draft and 15 to 19 s the checks.
- **Background gathers** verified 5 to 14 claims per topic.
- **Repeat questions** reused the stored pack: 10 to 16 claims, the early answer at 5 to 10 s, and the lesson at 40 to 44 s.

**Trade-offs:**

- The first learner to ask a new question always gets a model-knowledge lesson. Sources only reach later learners.
- Model-knowledge lessons are not reused (ADR 0011), so the second learner's lesson is drafted again, this time from the stored pack.
- Lessons that reuse a pack are slower than cold ones, because the early checked answer now runs before the draft instead of alongside gathering. Overlapping the two is a follow-up.
- The checks are now the largest stage. They are the next place to look for speed.
