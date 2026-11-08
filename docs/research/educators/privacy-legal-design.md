# Classroom privacy and legal design

- Status: **draft for legal review**. It is not legal advice. The open questions at the end need counsel before a school pilot.
- Date: 2026-11-08
- Issues: #112 (this design), #113 (classes), #117 (class summary), #116 (offline packs)
- Decision record: [ADR 0027](../../adr/0027-classrooms-without-learner-data.md)

## The design in one line

Teachers have accounts; pupils don't. A pupil joins a class through a link or code and we store nothing about them, so the classroom features add **no personal data about children**.

## Roles

| Who            | Account?                   | What we hold                                                                                     |
| -------------- | -------------------------- | ------------------------------------------------------------------------------------------------ |
| Teacher        | Yes, 18 or over (ADR 0020) | The existing account, a flag saying they turned on teaching tools, and the classes they made     |
| Pupil, any age | No                         | Nothing. The join code travels with their requests and is checked, then forgotten.               |
| School         | No                         | Nothing. The school is the teacher's employer, not our customer, until a contract says otherwise |

The 18+ limit is ours, not the law's: it keeps a 13-year-old account holder from running a class of younger children. It uses the age given at sign-up, so it is a self-declaration, like every age check in the app.

## What a class stores

| Data                                                 | Personal data?                                                                    | Kept for                                                    | Deleted by                     |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------ |
| Class name                                           | Possibly, if a teacher types a pupil's name; the form asks them not to            | Until the teacher archives the class or deletes the account | Teacher; account deletion      |
| Join code                                            | No: kept with a SHA-256 hash for lookups, so the teacher can copy it again (#412) | Until rotated                                               | Rotating the code              |
| Lesson list, curriculum and level                    | No                                                                                | With the class                                              | With the class                 |
| Controls (age band, blocked topics, tutor on or off) | No                                                                                | With the class                                              | With the class                 |
| Class activity counts (#117)                         | No: weekly counts per class, no visit or pupil id                                 | 52 weeks                                                    | Retention pass; with the class |

An archived class stops resolving straight away and is deleted 30 days later, so a mistaken archive can be undone. Account deletion removes classes in the same transaction as the account.

## What a class never stores

- Pupil names, emails, ages, rosters, or a list of who joined.
- Per-pupil answers, scores, progress or time on task. The summary shows only counts for the whole class, and hides any count below 5 (see below).
- Device ids or cookies that outlive the visit. The code sits in a cookie that ends when the browser session does.
- Tutor questions tied to a class. Pupils who aren't signed in use the existing per-visit tutor (24 hours, `docs/retention.md`).

The API still sees each pupil's IP address, as it does for anyone. It is used only for in-memory rate limits and is never written to the database or logs.

## The class summary (#117)

- **Fixed metrics only:** lessons opened, concept checks answered, concept checks correct, visuals used. Each is counted per class per ISO week.
- **Threshold:** a count below **5** is shown as "fewer than 5". When exactly one cell in a row is hidden, the next smallest is hidden too, so a total can't reveal it.
- **No drill-down:** there is no way to see a single pupil, a single visit, or a time finer than a week. This is a design rule, not a setting.
- Under-13s still send nothing to Mixpanel (ADR 0026). Class counts are written by our own API, hold no identifier, and stay in our database.

## Facilitator controls (#113)

Controls are enforced by the API, not just hidden in the page, because a pupil can edit a page:

- **Age band lock:** the class's band overrides the pupil's own choice.
- **Blocked topics:** a lesson whose risk category (medical, chemical exposure, weapons, self-harm, dangerous biology) is blocked for the class is held, with the standard safety message.
- **Tutor off:** tutor requests carrying the class code are refused.

Controls can only make a lesson safer than the default; they never unlock anything the app would hold.

## Offline packs (#116)

A pack holds a lesson, its visuals and their credits. Before export, the API runs the rights register check. A visual whose licence doesn't allow redistribution falls back to its text, and the pack says so. Evidence quotes are only included where the source allows reuse. A pack contains nothing about the person who saved it.

## Law, by country

| Rule                                                    | Why it applies                         | How the design meets it                                                                                                                                                                                                                                          |
| ------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **COPPA** (US, under 13)                                | Pupils may be under 13                 | No personal information is collected from pupils. IP addresses are used only for internal operations (rate limits), which COPPA's support-for-internal-operations exception covers.                                                                              |
| **FERPA** (US schools)                                  | Teachers may share education records   | We hold no pupil records, so nothing we store is an education record. Teachers are told not to put pupil names in class names.                                                                                                                                   |
| **State student-privacy laws** (e.g. California SOPIPA) | Apply to services used for K–12        | No pupil data, no advertising, no profiling. Needs counsel confirmation per state before district deals.                                                                                                                                                         |
| **Nigeria Data Protection Act 2023 (NDPA)**             | Nigerian teachers and pupils           | Teacher data: lawful basis is the teacher's contract with us (s.25). Pupils: no personal data, so the parental-consent rule for children (s.31) isn't triggered. Hosting is outside Nigeria, so teacher data relies on a cross-border transfer basis (ss.41–43). |
| **NDPC registration** (NDPA s.44)                       | "Data controllers of major importance" | Unlikely at pilot scale; counsel to confirm the threshold.                                                                                                                                                                                                       |
| **UK GDPR and Children's Code**                         | If UK schools join                     | Data minimisation by design; a DPIA is still needed before a UK pilot.                                                                                                                                                                                           |

## One-page summary for schools

> Teachers sign up with their own account. Pupils open a class link and never sign in. We don't collect pupils' names, emails, ages or answers, and we can't see which pupil did what. Teachers see only whole-class counts, and any number under 5 is hidden. Teachers can lock the age level, switch off sensitive topics and turn off the tutor, and the server enforces these. Lessons can be saved for offline use with their credits kept. Questions: \_\_\_ (email).

## Open questions for counsel

1. NDPA: which cross-border transfer basis do we use for Nigerian teachers' account data, and do we need to file anything with the NDPC at pilot scale?
2. COPPA: does showing a class code in a URL, or the IP address used for rate limits, create any notice duty to schools?
3. US: do we need a standard data privacy agreement (e.g. the SDPC national DPA) before district pilots?
4. Is a teacher's self-declared age at sign-up enough for the 18+ rule, or do schools need to invite teachers?
5. Class names: is the warning enough, or should we block likely personal names?
