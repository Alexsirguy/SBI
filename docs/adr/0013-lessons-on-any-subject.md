# 0013. Lessons on any subject, started straight from recognition or a description

- Status: accepted
- Date: 2026-10-30
- Issue: #278
- Amends: the confirm step from epic #33 (E4 recognition)

## Context

Until now every lesson started from a catalogue object the learner had confirmed:

- Recognition could only suggest catalogue entries. The model's own names went into a side list when nothing matched.
- The learner had to tap a suggestion, or search the catalogue, and then press Start lesson.
- The lesson API rejected any request without a catalogue `taxonomyId`.

The catalogue holds 68 entries. A photo of a kettle came back as "Teapot or coffee pot?", because "kettle" names two entries and so is never treated as confident. Anything outside the catalogue could not be taught at all.

The owner's decision (2026-10-30): "We don't need to have an object to make a lesson for it." When a photo is recognised, the lesson should start straight away. Typed text should start a lesson the same way.

## Decision

- **A lesson request names a catalogue object or a free subject.** `LessonRequest` takes an optional `taxonomyId` or an optional `subject` (2 to 80 characters), and needs one of them.
- **The API resolves a subject before teaching it** (`apps/api/src/lesson/subject.ts`):
  - A subject that is exactly one catalogue name or alias uses that entry, with its facts, concepts and safety notice.
  - Any other subject becomes a stand-in entry with id `subject.<slug>` and no facts. Evidence is gathered at request time and model knowledge fills the gaps (ADR 0011). Lesson storage and reuse key on that id, so no schema change is needed.
  - A stand-in whose words belong to a high-risk topic (medicines, household chemicals, mains electricity, wild mushrooms) takes that topic as its parent. It then gets the topic's safety notice and high safety class, as catalogue entries do. This stays a word list until the classifier lands (#67).
- **Recognition returns `subject`**, the model's strongest name for what it sees, whether or not it is in the catalogue.
- **The web app starts the lesson as soon as a subject is known:**
  - Photo: once recognition names something, the page goes straight to the lesson. If the model names nothing, or recognition is unavailable, the learner is asked to describe it instead.
  - Text: "What is it?" and Start lesson. There is no catalogue search.
  - The lesson page always offers "Not a …? Describe it instead", because the lesson started without asking.
- **The pick, search and "tell us what you notice" steps are removed from the web app.** Their API routes stay for now.

## Consequences

- Anything a learner can photograph or name can be taught. Catalogue entries still improve lessons that match them.
- A wrong recognition now costs one lesson generation before the learner corrects it. The way back is one link on the lesson page.
- Recognition no longer records the learner's pick (`/recognitions/selection`), so calibration loses that signal. A correction from the lesson page could restore it later.
- Safety for free subjects rests on a word list. It can miss unusual wording and over-warn on rare look-alikes. The classifier in #67 replaces it.
- Stand-in subjects have no curated facts, so their lessons lean more on request-time evidence and model knowledge, with the disclaimer ADR 0011 requires.
