# Usage statistics: Mixpanel setup and the funnel board

Usage statistics follow ADR 0026: they're sent to Mixpanel only after the learner accepts "Share usage statistics", never in the child pathway or band, and with one random ID per visit. This page covers setting up the Mixpanel project and building the board that #77 asks for.

## 1. Set up the project (once)

1. Create a Mixpanel project with **EU data residency**. The region can't be changed later.
2. In **Project settings → Data retention**, choose the shortest period on the plan, and record it in `docs/retention.md`.
3. In **Project settings → Privacy**, check that IP collection is off. The SDK also sends `ip: false`.
4. Set `NEXT_PUBLIC_MIXPANEL_TOKEN` to the project token in the web build's environment and rebuild. The token is public by design, but keep it out of the repo. Without it nothing is sent, and the lesson page's CSP doesn't allow Mixpanel.
5. Sign Mixpanel's DPA. It's an open item in `docs/launch-review.md`.

## 2. What arrives

Every event carries `consentVersion`, `route`, `locale`, `ageBand` (`teen`, `adult` or `general`), `deviceTier` (`low`, `mid` or `high`) and `displayMode` (`browser` or `installed`, for ADR 0028). `distinct_id` is the visit ID.

| Event                   | Sent when                                                | Properties                                                     |
| ----------------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| `capture_started`       | The camera opens, a file is picked or a subject is typed | `source`: camera, upload or describe                           |
| `photo_submitted`       | The cropped photo is sent                                | `source`, `fileClass`, `sizeBucket`                            |
| `recognition_shown`     | Recognition answers                                      | `optionCount`, `topCertainty`, `elapsed` since sending         |
| `recognition_confirmed` | The learner picks one of the options                     | `rank`, `certainty`                                            |
| `recognition_corrected` | The learner names it themselves or retakes               | `correctionClass`: described or retake                         |
| `lesson_first_content`  | The first quick answer or lesson appears                 | `kind`, `elapsed` since the capture started, lesson id/version |
| `section_opened`        | Half of a lesson section is on screen                    | lesson id/version, `sectionId`                                 |
| `visual_loaded`         | A visual finishes drawing                                | `visualId`, `kind`, `elapsed`                                  |
| `interaction_changed`   | A slider is let go                                       | `visualId`, `controlId`, `rangeBucket`                         |
| `tutor_question`        | The tutor replies                                        | lesson id/version, `replyKind`, `citedCount`                   |
| `lesson_rated`          | Ratings are submitted                                    | lesson id/version, `helpful`, `clear` (1–5)                    |
| `issue_reported`        | A problem report is sent                                 | lesson id/version, `category`, never the typed details         |
| `lesson_saved`          | A lesson is saved or removed                             | lesson id/version, `action`                                    |

`timing_measured` (#82) carries `metric` and raw `ms` for time to label, first readable lesson and interactive-ready (docs/operations/performance-budgets.md). `answer_feedback` (tutor helpfulness) is defined in `@sbi/analytics`, but nothing sends it until tutor feedback ships.

## 3. The board: "Learner funnel"

Create one board with these reports. Name them as below, so later issues can refer to them.

1. **Funnel: capture to lesson** (Funnels):
   - Steps: `capture_started` → `photo_submitted` → `recognition_shown` → `recognition_confirmed` → `lesson_first_content` → `section_opened`.
   - Conversion window: 30 minutes; count unique `distinct_id` (visits).
   - Break down by `source`, then by `deviceTier`.
2. **Funnel: typed subject to lesson:** `capture_started` where `source = describe` → `lesson_first_content` → `section_opened`.
3. **Time to first lesson** (Insights):
   - Event `lesson_first_content`, broken down by `elapsed` bucket, as a stacked bar per day.
   - Exact p50/p95: `timing_measured` filtered by `metric`, aggregated as the 50th and 95th percentile of `ms`, broken down by `deviceTier`.
4. **Recognition corrections** (Insights): `recognition_corrected` ÷ `recognition_shown`, per week, broken down by `correctionClass` and `topCertainty`.
5. **Lesson depth** (Insights): `section_opened` per `lesson_first_content`, broken down by `ageBand`.
6. **Visual use** (Insights): `interaction_changed` per `visual_loaded`, broken down by `kind`.
7. **Ratings** (Insights): average of `clear` and `helpful` on `lesson_rated`, per week, broken down by `ageBand` and `topic`.
8. **Concept check:** the reports in `docs/research/learning-signal/README.md`.
9. **Reports by category** (Insights): `issue_reported` by `category`.

## 4. Reading it honestly

- The sample is consenting learners aged 13 and over. Say so beside every number, and don't present a rate as true of all learners.
- These are signals, not proof of learning (spec §13). Pair them with the learning-signal instrument (#81) and with studies.
- Don't optimise for more events per visit, such as more sections opened or more slider moves. The spec warns against optimising for time spent or for the number of questions asked.
