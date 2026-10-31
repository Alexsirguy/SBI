# 0016. Gather less evidence, faster, and let model knowledge fill the rest

- Status: accepted
- Date: 2026-10-31
- Issue: #
- Amends: 0009 (search depth); relies on 0011

## Context

A cold lesson took about three minutes. Measured on 31 October 2026 (kettle, swing and guitar, fresh, three at once), the lesson arrived 184 to 194 s after the request. A single swing lesson alone took 180 s.

The API log showed where the time went:

- **Fetching:** each sub-question fetched up to 8 references one after another, taking 16 to 46 s.
- **Search:** the first search after start-up spent about 20 s building the LibreTexts index.
- **Sub-questions:** 3 to 6 of them, run 3 at a time, so most lessons needed two rounds.
- **LLM calls:** about 16 per lesson after gathering. The draft alone took up to 20 s.

ADR 0011 already lets model knowledge fill any gap and says so in one disclaimer. Chasing more sources therefore makes a lesson slower without making it possible.

## Decision

- **Sub-questions:** the inquiry plan asks for 2 or 3 (was 3 to 6), and all of them run at once.
- **Sources per sub-question:**
  - 2 open-textbook pages, 2 Wikipedia articles and 1 reference from each, at most 3 references in all (were 3, 4, 3 and 8).
  - Textbook pages still come first.
- **Fetching:** a sub-question's sources are fetched in parallel. The polite fetcher still spaces requests to any one host.
- **Slow sources are dropped, not waited for:**
  - Source requests time out after 8 s with 2 attempts (were 15 s and 3).
  - Gathering stops after `EVIDENCE_BUDGET_MS`, 25 s by default (was 150 s). The lesson is drafted with whatever was verified.
- **Judging:** each claim is judged against 2 passages (was 3): its own source and the best other source. One passage would make a second, independent source impossible, so no claim could be `supported` or `disputed`.
- **Start-up:** the LibreTexts index starts building when the API starts.
- **Timing log:** each lesson logs one line with milliseconds to `gatheredMs`, `modelKnowledgeMs`, `draftedMs` and `checkedMs`.

**Target:** a cold lesson in 30 s or less at p50.

## Consequences

- More claims come from model knowledge, so more lessons carry the model-knowledge disclaimer. Fewer claims reach two independent sources.
- A pack cut short by the budget is still not stored for reuse, so a topic whose sources are slow is gathered again next time.
- Every number above is an option or an environment setting, so it can be tuned against the timing log without a code change.
