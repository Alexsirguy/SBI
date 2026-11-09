# 0029. Curriculum catalogue and the lesson library

- Status: accepted
- Date: 2026-11-09
- Issue: #416 (epic #415)

## Context

Lessons reach the curriculum only by guessing. `alignmentsFor` matches a lesson's concept words against a starter set of 47 Nigerian and 62 US entries kept in code (#114). Nothing records that a lesson was made for a topic, and a teacher can't ask for one. The owner wants every topic of the curricula we support in the database. Teachers should be able to make class lessons from a topic, and every topic should have a ready-made lesson with a working lab, so pupils can use it in place of a textbook.

We treat the product as commercial, as ADR 0009 does for evidence sources. Terms that only allow non-commercial or school use don't cover us.

## Decision

### Scope (owner, 2026-11-08)

- **United States:** all of NGSS (K–2, 3–5, 6–8, 9–12; physical, life, Earth and space science, engineering design), and Common Core maths for grades 6–8 and high school.
- **Nigeria (NERDC):** Basic Science and Technology for Primary 4 to JSS3, Mathematics for JSS1–JSS3, and Mathematics, Physics, Chemistry and Biology for SSS1–SSS3.

### The catalogue

- **Repo files are the source.** Topic lists live as versioned data files in `@sbi/taxonomy`, so every change is reviewed in a pull request. A sync step run with migrations loads them into the `curricula`, `curriculum_subjects` and `curriculum_topics` tables (#417).
- **Topics are never deleted.** A topic that leaves a list is marked retired, so a lesson never loses its link.
- **Codes.**
  - NGSS and Common Core topics keep their official codes, such as `MS-PS1-4` and `7.RP.A.2`.
  - NERDC publishes no codes, so ours are `NG-<subject>-<class>-<theme>-<topic>`, for example `NG-PHY-SSS1-MOTION-SPEED`.
  - A code never changes once used.
- **Titles and learning goals are our own words.**
  - We store each standard's official code, a short title we wrote, our learning goals, concept keys and a link to the official text.
  - We don't copy the standards' own text into the catalogue or the app (see Rights).
  - Placement and goals are our reading of each curriculum, pending review by teachers in each country.
- **Lesson links are recorded, with how they were made.** `lesson_topics` stores one row per lesson and topic:
  - `exact` when the lesson was made for that topic (#422);
  - `inferred` when the concept matcher found it.
  - The lesson page shows exact links first.
- **A big topic can have a few lessons in order ("parts").** NERDC topics such as motion or organic chemistry are more than one lesson.

### The library

- **One pipeline, a different model.** Library lessons come from the same lesson pipeline as teachers' requests: evidence, draft, visual and repair loop, automated checks. The difference is that the model work is done by Claude Code (`claude -p`) on a maintainer's machine (#427). Production keeps the Meta provider for teachers' on-demand lessons.
- **Shipped as files.** Each passing lesson is exported, with its visuals and lab, to `@sbi/library`. Those files are reviewed in a pull request, and the migrate step loads them into every environment as shared lessons, the way reference visuals are loaded (#424). Production gets exactly what was reviewed and never regenerates them.
- **Published after the automated checks, reviewed by a person later** (owner, 2026-11-08).
  - A library lesson is `auto-validated`, carries the `awaiting-review` notice, and enters the review queue.
  - Merging its file is a check of the build, not that review.
  - Only the review flow marks a lesson `approved`.
- **Pilot first.** The first four topics of each subject are built and evaluated with the owner before the rest (#428).

### Rights

Each framework has a record in `@sbi/rights` (`CURRICULUM_SOURCES`). It records the owner, the terms we checked, what we store, the notice we show, and when to look again.

| Framework                | Terms (checked 2026-11-09)                                                                                                                                                                                      | What we store                                                                                | What we show                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| NGSS                     | Copyright National Academies Press. The public licence covers states, districts, schools, teachers and non-profit education bodies, which isn't us. The trademark guidelines govern commercial use of the name. | Codes, our own titles and goals, links to nextgenscience.org                                 | WestEd's trademark disclaimer wherever the NGSS name first appears on a page |
| Common Core maths        | © 2010 NGA Center and CCSSO. The public licence allows copying and display "for purposes that support the Common Core State Standards Initiative", with the copyright notice.                                   | Codes, our own titles and goals, links to the official text                                  | The NGA/CCSSO copyright notice wherever we show Common Core codes            |
| NERDC (BST, JSS and SSS) | No published licence found. The curriculum documents are NERDC's.                                                                                                                                               | Topic names and their order (facts about the curriculum), our own goals, the edition we used | "Topic list from the NERDC curriculum; goals and alignments are our own."    |

## Consequences

- Teachers and pupils can rely on links made for a topic, while guessed links stay labelled as related.
- Every library lesson's text and lab is reviewed as a file before release, and production can't drift from what was reviewed.
- Library builds depend on a maintainer's Claude Code session and its usage limits. A run stops and resumes, so a long build can span several sessions.
- Using our own wording keeps us inside the standards' terms. The cost is that pupils and teachers follow a link to read a standard's official text.
- **Open for counsel:**
  - whether quoting full NGSS or Common Core text would need written permission (we don't quote it);
  - whether WestEd wants to review the pages where the NGSS name appears (its guidelines ask commercial users to send samples first);
  - whether a NERDC topic list, as a selection, needs NERDC's consent.
