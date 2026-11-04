# 0026. Usage statistics go to Mixpanel, only with consent, never for under-13s

- Status: accepted
- Date: 2026-11-04
- Issue: #75

## Context

Spec §13 lists product events (capture through feedback) to understand the funnel, time to value and learning signal. Spec §12 says analytics must avoid images, faces, raw tutor text and precise location, use pseudonymous identifiers, and ask for separate opt-ins. Until now the privacy corner promised "No ads, no analytics", and only two events existed: next-concept clicks and lesson cost, both written to the API log with no learner identifier (ADR 0024).

## Decision

- **Mixpanel, in the browser, EU data residency (owner's choice).**
  - The web app loads `mixpanel-browser` and sends events to Mixpanel's EU endpoint.
  - The owner chose Mixpanel for its ready-made funnels, percentiles and boards.
- **Only with consent, as its own purpose.**
  - A fifth purpose, `usage-statistics`, joins the four in ADR 0019. It is asked and declined like the others.
  - Adding it changes the wording, so `CONSENT_VERSION` becomes `consent-2`, and every learner is asked again.
  - With no answer, or a no, Mixpanel is never loaded and nothing is sent. Withdrawing stops sending at once.
- **Never for under-13s.** In the child pathway the request is not shown, and nothing is sent even if an earlier answer said yes.
- **One visit, one random ID.**
  - The distinct ID is a random UUID held in `sessionStorage`. Mixpanel's own persistence is off, so it cannot follow a learner across visits.
  - No account ID, email or IP is sent (`ip: false`).
- **One door for every event.**
  - `track()` in `@sbi/analytics` parses each event against its own strict schema, then a payload guard, before a sink sees it.
    - Unknown properties fail.
    - So do free text longer than 80 characters, `data:` or base64 blobs, and keys naming text, questions, answers or location.
  - Only `@sbi/analytics` may import `mixpanel-browser` (lint rule).
  - Autocapture and automatic page views are off.
  - `$current_url`, `$referrer` and `$initial_referrer` are dropped, because lesson URLs carry the learner's typed question. Events carry a route name instead.
- **Coarse values only.** Sizes, times and confidences are sent as buckets. The age band is sent as `teen`, `adult` or `general` and never `child`. The device tier is a coarse class.
- **Loaded after consent.** Mixpanel is a dynamic import, so pages without consent keep their JS budget, and the analytics chunk has its own budget.
- **Server events stay in our logs.** `lesson-cost`, `next-concept` and LLM usage carry no learner ID and need no consent (ADR 0024). They are not sent to Mixpanel.
- **Retention:** the Mixpanel project uses its shortest data-retention setting, recorded in `docs/retention.md`.

## Consequences

- Funnels and p50/p95 timings cover consenting learners aged 13+ only, so they are a biased sample, which reports must say.
- Mixpanel is a processor of learner data. The privacy page names it, and the launch review must cover its DPA and the EU region before launch.
- A learner can't look up their visit ID, so deletion requests go through support, matched by time. The privacy page says so.
- Changing which properties an event may carry means changing its schema in `@sbi/analytics`, so every new property gets reviewed in code.
- Without `NEXT_PUBLIC_MIXPANEL_TOKEN` the sink is off, so development and CI send nothing.
