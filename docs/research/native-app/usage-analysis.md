# Native app usage analysis (E13-4)

- Status: **no data yet**, so the decision in [ADR 0028](../../adr/0028-web-first-installable-app.md) rests on cost and reach, not usage.
- Date: 2026-11-08
- Issue: #115

## What we have

- **No usage numbers in the repo.** Mixpanel (ADR 0026) holds the only usage data, and the project has no production traffic yet.
- **Repeat use can't be measured by design.** Each visit gets a fresh random ID, and Mixpanel's persistence is off. We will not change that to answer this question.
- **No interview answers.** The learner and teacher syntheses (`docs/research/interviews/`, `docs/research/educators/`) are not started.
- **Load budgets on slow phones** from the visuals evaluation (`docs/research/visuals/2026-10-31-visual-evaluation.md`), which show the web app already fits low-end Android.

## What a native app would buy

| Need                   | Web today                                             | Native adds                                               |
| ---------------------- | ----------------------------------------------------- | --------------------------------------------------------- |
| Camera capture         | `getUserMedia` and file input work on iOS and Android | Faster start, manual focus, no permission prompt per site |
| Install to home screen | Possible once the app is a PWA (#116)                 | Store presence                                            |
| Offline lessons        | Service worker and saved packs (#116)                 | Larger storage quotas, background download                |
| Face blur on device    | MediaPipe in the browser (ADR 0018)                   | Native ML, faster on low-end phones                       |
| Notifications          | Web push, limited on iOS                              | Full push                                                 |

None of these is a blocker. The costs are two more codebases, store review, and children's-app store rules on top of COPPA and the NDPA.

## Signals to watch

All from Mixpanel, consenting learners 13+ only, so a biased sample (ADR 0026). `displayMode` was added to every event's context for this.

| Question                       | Report                                                                                       | Threshold that reopens the ADR                        |
| ------------------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Do people photograph or type?  | `capture_started` split by `source`                                                          | Camera is over 60% of captures for 8 straight weeks   |
| Does capture fail on phones?   | Funnel `capture_started` (camera) → `photo_submitted` → `recognition_shown`, by `deviceTier` | Camera drop-off over 30% on low-tier devices          |
| Do people install the web app? | Share of events with `displayMode: installed`                                                | Over 25% of lesson events come from the installed app |
| Is offline used?               | Offline pack saves and opens (#116 events)                                                   | Over 15% of lessons saved for offline                 |
| Do teachers ask for it?        | Teacher synthesis                                                                            | Most teachers name a store app as a condition of use  |

Run the reports monthly once there is traffic, and add the numbers to this page with the date.
