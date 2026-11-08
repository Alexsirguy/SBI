# Launch review: privacy and child safety

Spec §14's Phase 1 gate is "Privacy/safety review passed". Spec §12 asks for a privacy and child-safety review of each launch region, covering consent, age assurance and data transfer, with providers and regions configured to match.

This page is the checklist for that review. **It is not legal advice, and ticking it is not the review.** A qualified privacy reviewer must work through it for each launch region, record each answer and any evidence link next to the item, and sign it off at the bottom. Where a law is named, the reviewer confirms how it applies today; the notes only point to where to look.

Status key: ☐ open · ☑ confirmed (initials, date and evidence next to it) · ✗ blocks launch.

## 0. Decide the launch regions

- ☐ List the launch regions. The repo assumes none. Likely candidates from the spec's audience (families, learners roughly 8 to 12, adults) are the UK, the EU/EEA and the US. Each region needs every section below.
- ☐ Decide whether the app is offered to children directly, or to families with a parent present. That decision drives sections 2 and 3.

## 1. What the product does today

Facts for the reviewer, from the code. Links are to the decision records.

| Topic               | Today                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts            | None. Anonymous sessions only.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Photos              | Faces are pixelated on the device before upload (ADR 0018). Location and camera data are removed on the device and again on the server. Photos are stored privately and deleted about an hour after recognition, or within 7 days at most, unless the learner chooses to keep one (`docs/retention.md`).                                                                                                                                       |
| Recognition         | The photo goes to Meta's model API (Muse Spark, Standard mode), falling back to OpenAI (`store: false`). Neither may train on it (ADR 0006). The recogniser never names or describes people.                                                                                                                                                                                                                                                   |
| Lessons             | The question and subject go to the lesson model (the same vendors). Searches built from the question go to Wikipedia, LibreTexts and other open sources (ADR 0009, 0016).                                                                                                                                                                                                                                                                      |
| Age                 | The age band is optional, chosen by the learner, kept in the browser tab and never guessed. It shapes reading level and holds back questions meant for older learners (#331).                                                                                                                                                                                                                                                                  |
| Safety              | Each question is classified by keyword rules plus a model. Questions seeking harm get help resources instead of a lesson, and children's lessons only suggest safe activities (#67, #68).                                                                                                                                                                                                                                                      |
| Consent             | Each purpose (saving photos, linking to an account, model improvement, research, usage statistics) has its own Accept and Decline, in the privacy panel on every page and on the privacy page, with Accept all and Decline all beside them. An unanswered request counts as declined, and nothing is blocked while it is unanswered. A child's Accept waits for a grown-up check. Each answer is recorded with its consent version (ADR 0019). |
| Analytics           | Mixpanel in the browser, EU residency, only with the `usage-statistics` consent and never in the child pathway or band. One random id per visit, no IP or URL; every event passes the schema and payload guard in `@sbi/analytics` (ADR 0026).                                                                                                                                                                                                 |
| Cookies and storage | One cookie, set only on sign-in, keeps the learner signed in for 30 days. `sessionStorage` holds depth and age band. `localStorage` holds consent choices, the list of kept photos and whether the privacy notes in the corner are folded away.                                                                                                                                                                                                |
| Classes             | Adults (18+) with a confirmed account can turn on teaching tools and make classes. Pupils join by a code with no account; nothing about them is stored. Teachers can lock the age band, hold risk categories and turn the tutor off, all enforced by the API (ADR 0027, `docs/research/educators/privacy-legal-design.md`).                                                                                                                    |
| Retention           | Every data class and its deadline is in `docs/retention.md`.                                                                                                                                                                                                                                                                                                                                                                                   |

## 2. Consent

- ☐ **Lawful basis for each processing purpose.** Recognising a photo, writing a lesson, keeping a photo and feedback each need a recorded basis. Today recognition runs because the learner uploads a photo, and keeping a photo runs on explicit opt-in.
- ☐ **Who can give consent.** Where consent is the basis and the learner is a child, confirm whether a parent must give or confirm it in this region:
  - UK GDPR: 13 for online services.
  - EU GDPR Art. 8: 13 to 16, set by each member state.
  - US COPPA: under 13, with verifiable parental consent, as amended in 2025; confirm the compliance date.
- ☐ **Keeping a photo.** The opt-in is asked at the moment it applies and never pre-ticked. Confirm whether a child can give it alone, or whether keeping should be offered only to adults or with a parent.
- ☐ **Withdrawal.** Declining "Keep photos I choose to keep" deletes every kept photo at once, and declining the account link unlinks it. Confirm this meets the withdrawal duties.
- ☐ **Wording.** The privacy page, capture page and keep explanation are in plain words. Confirm they are understandable for the youngest audience, as the UK Children's Code expects for transparency.
- ☐ **Model improvement and research.** These can be accepted today, but nothing uses them yet, and the wording says so. Confirm no flow can send learner data for training or research without a recorded Accept, and that the wording is reviewed again (with a `CONSENT_VERSION` bump) before either feature ships.

- ☐ **Mixpanel as a processor.** Sign its DPA, confirm the project is in EU residency with the shortest data retention, and confirm usage statistics on consent alone meet each region's rules (ADR 0026).

## 3. Age assurance

- ☐ **Decide the approach for each region.** Today the app asks nothing about age and assumes a general audience. The child band adds protections but is self-chosen. Options range from none (a service suitable for all ages) to self-declaration or a parent gate. The UK Children's Code expects a proportionate approach, or applying the child standards to every user.
- ☐ **If children are in scope (US COPPA):** confirm whether the service is "directed to children". If so, collecting a photo or free text from under-13s needs verifiable parental consent, or an exception has to apply.
- ☐ **Defaults.** Check that high-privacy defaults hold for every learner:
  - nothing is kept;
  - no profiling, and no analytics unless the learner accepts usage statistics (never under 13);
  - no public sharing;
  - questions meant for adults are held back unless an adult band is chosen.
- ☐ **Self-declared adult band.** A child can choose "Adult" to unlock a question held back for older learners (#331). Confirm this is acceptable with the content that could be unlocked, or decide what extra check is needed.
- ☐ **Harmful content.** Confirm the safety rules (#67, #68, #331) meet each region's child-safety duties, such as the EU DSA Art. 28 protection of minors and the UK Online Safety Act, if the service is in scope.

## 4. Data transfer

- ☐ **Map every place data goes**, using section 5. For each vendor outside the launch region, confirm the transfer mechanism, such as an adequacy decision, the EU Data Privacy Framework, SCCs or the UK IDTA/Addendum.
- ☐ **Data processing agreements** signed with every processor: storage, database host, hosting, and each model vendor.
- ☐ **Meta's written retention terms for Standard mode** are still open (ADR 0006). Get them in writing, or turn photo recognition off (`FEATURE_FLAGS=!photoRecognition`) in the regions that need them.
- ☐ **OpenAI abuse-monitoring retention**, up to 30 days: confirm it is acceptable, or whether zero data retention is needed.
- ☐ **Open-source searches.** Search terms built from the learner's question go to Wikipedia, LibreTexts and others. Confirm they hold no personal data. The planner rewrites the question into sub-questions, but a learner could type personal details.
- ☐ **Data residency.** Confirm whether any region requires data to stay in-region. If so, choose a storage location, database region and model endpoints to match (section 5).

## 5. Provider and region configuration

Each row is a place learner data goes, what goes there and the setting that controls it. "Region" is where to set the location. The reviewer records the chosen value.

| Service                                                         | Data sent                                                                                    | Configured by                                                 | Region / location                                                                                                                                       | Chosen |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Object storage (Cloudflare R2 in production, SeaweedFS locally) | Blurred, metadata-free photos                                                                | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`                       | R2 jurisdiction is chosen when the bucket is made, e.g. EU, FedRAMP or automatic. It must have versioning off and no replication (`docs/retention.md`). | ☐      |
| Database (MariaDB)                                              | Recognition results, tutor turns, feedback, lessons, evidence, audit logs                    | `DATABASE_URL`                                                | The host's region, plus its backup region and the 30-day backup policy                                                                                  | ☐      |
| API and web hosting                                             | All requests; logs with counts and telemetry, never content                                  | Deployment                                                    | The host's region, plus 30-day log retention                                                                                                            | ☐      |
| Meta model API (Muse Spark)                                     | Photo for recognition; question, subject and evidence for lessons, safety checks and visuals | `META_MODEL_API_KEY`, `LESSON_MODEL`, `RECOGNITION_PROVIDERS` | `https://api.meta.ai/v1`, with no region choice in code; confirm where it processes                                                                     | ☐      |
| OpenAI API (fallback)                                           | The same as Meta, when Meta fails                                                            | `OPENAI_API_KEY`, `RECOGNITION_PROVIDERS`                     | `https://api.openai.com/v1`; confirm whether data residency, such as the EU endpoint, is needed                                                         | ☐      |
| Google sign-in (Google Identity Services)                       | Nothing from us; the learner signs in with Google, which sends us their name and email       | `GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`            | Google's; no region choice                                                                                                                              | ☐      |
| Email (ZeptoMail)                                               | Learner's email address and name, with a one-time confirm or reset link                      | `ZEPTOMAIL_TOKEN`, `ZEPTOMAIL_FROM`, `ZEPTOMAIL_API_URL`      | The ZeptoMail data centre (US, EU or IN) matching `ZEPTOMAIL_API_URL`                                                                                   | ☐      |
| Malware scanner (ClamAV)                                        | Uploaded bytes, scanned in our own infrastructure                                            | `CLAMAV_HOST`, `CLAMAV_PORT`                                  | Runs with the API                                                                                                                                       | ☐      |
| Open sources (Wikipedia, LibreTexts and others)                 | Search terms built from the question                                                         | Code (`@sbi/evidence`); contact via `EVIDENCE_CONTACT`        | Public services                                                                                                                                         | ☐      |
| Face detector (MediaPipe)                                       | Nothing: it runs on the device and is served from our own site (ADR 0018)                    | —                                                             | —                                                                                                                                                       | —      |

**To turn something off per region:**

- **Photo recognition:** set `FEATURE_FLAGS=!photoRecognition`, so learners describe the object instead.
- **A vendor:** set `RECOGNITION_PROVIDERS` to drop it from the chain.
- **The lesson model:** leaving `LESSON_MODEL` unset means no model is called for lessons or safety checks.
- **Retention:** every deadline can be shortened by its env variable (`docs/retention.md`).

## 6. Rights of the people using it

- ☐ **Access and deletion requests.** Without accounts, a session can't be tied to a person. Kept photos can be deleted from the device ("Your choices"). Confirm the process for a request that arrives by email, and who handles it.
- ☐ **Incident response.** The spec requires deletion-request and incident-triage workflows to be exercised before public release. Name the owner and run one of each.
- ☐ **A contact for privacy questions** on the privacy page.
- ☐ **Records:** a record of processing, and a DPIA, or for the UK a Children's Code DPIA, if the review finds one is needed.

## Sign-off

| Region | Reviewer | Date | Outcome | Blocking items |
| ------ | -------- | ---- | ------- | -------------- |
|        |          |      |         |                |
