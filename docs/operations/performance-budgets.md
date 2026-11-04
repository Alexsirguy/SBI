# Performance budgets by device tier (#82)

Spec §10 asks for measured targets by device tier and network profile before public launch: median and p95 time to candidate label, first readable lesson, and interactive-ready state, with 3D loading after the text. It warns against claiming one universal latency. This page defines the tiers, the budgets CI enforces, and where the real-world numbers come from.

## Tiers and network profiles

Defined once in `apps/web/e2e/tiers.ts`.

| Tier      | Stands for                  | Screen      | CPU         | Network                                           |
| --------- | --------------------------- | ----------- | ----------- | ------------------------------------------------- |
| `low`     | A budget Android (ADR 0005) | 360×740 @2× | 4× slower   | Slow 4G: 562 ms RTT, 1.44 Mbps down, 0.67 Mbps up |
| `mid`     | A mid-range phone           | 390×844 @3× | 2× slower   | 4G: 150 ms RTT, 9 Mbps down, 3 Mbps up            |
| `desktop` | A laptop on broadband       | 1280×900    | Unthrottled | 20 ms RTT, 50 Mbps down, 20 Mbps up               |

In the field, `deviceTier` on every usage event is a coarse class from what the browser reports (`@sbi/analytics` `deviceTier`). It's `low` with 2 cores or fewer, 2 GB or less, or a 2G connection. It's `high` with 8+ cores, 8+ GB and no 3G. Everything else is `mid`. Field `high` corresponds to lab `desktop`.

## What is measured

| Metric                  | Starts                                                              | Ends                                                                    | Mark / event                |
| ----------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------- |
| Time to candidate label | The photo is sent                                                   | Recognition's options are shown                                         | `sbi:time_to_label`         |
| First readable lesson   | The capture or typed subject that led here, or page load for a link | The quick answer or lesson first appears                                | `sbi:first_readable_lesson` |
| Interactive-ready       | Same as above                                                       | The lesson is complete and its experiment has drawn, or there is none   | `sbi:interactive_ready`     |
| Paint and blocking      | Navigation                                                          | First and largest contentful paint; total blocking time from long tasks | Browser timings             |

Each timing is a `performance.mark` that CI reads. With consent, it's also a `timing_measured` event with the raw milliseconds, so Mixpanel can show real p50 and p95 per `deviceTier` (ADR 0026).

## Budgets enforced in CI

`apps/web/e2e/performance.spec.ts` runs in the e2e job with the API mocked, so it times our pages and not the models. It uses Chrome DevTools throttling, the same engine as Lighthouse. We use it rather than Lighthouse CI because the lesson needs Playwright's API mocks to load at all.

| Tier      | FCP   | LCP   | First readable lesson | Interactive-ready | Total blocking |
| --------- | ----- | ----- | --------------------- | ----------------- | -------------- |
| `low`     | 3.0 s | 4.0 s | 7.0 s                 | 8.0 s             | 800 ms         |
| `desktop` | 1.0 s | 1.5 s | 1.5 s                 | 2.0 s             | 200 ms         |

The pages measured are home and capture (paint and blocking) and a lesson (all five).

These were measured on 2026-11-04 on an Apple-silicon laptop with the same throttling:

| Tier      | FCP   | LCP   | First readable | Interactive | Blocking |
| --------- | ----- | ----- | -------------- | ----------- | -------- |
| `low`     | 1.5 s | 1.5 s | 3.9 s          | 3.9 s       | 95 ms    |
| `desktop` | 0.1 s | 0.1 s | 0.2 s          | 0.2 s       | 0 ms     |

The budgets leave room for CI's slower, shared runners. Tighten them once a few weeks of CI timings show the spread.

The weight budgets in `budgets.spec.ts` still apply: 232 KB of JS per page, and 40 KB more for Mixpanel, only after consent.

The `mid` tier isn't run in CI. It's there for manual runs and to label field data. The opt-in `visual-budgets.spec.ts` (`VISUAL_BUDGETS=1`) measures each visual kind on the `low` tier.

## Field targets (to set before launch)

Lab budgets show the front end is fast enough. They can't show what learners get, because recognition and lesson writing dominate in the field.

1. Collect at least two weeks of `timing_measured` from consenting learners aged 13+.
2. Report p50 and p95 per metric and `deviceTier` (Mixpanel Insights, `ms`, broken down by `deviceTier`).
3. Set the launch targets from that baseline with engineering and product. Record them here with the date and the sample size.
4. Say every time that the sample excludes under-13s and learners who declined.
