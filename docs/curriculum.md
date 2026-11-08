# Curriculum links

Lessons can show which curriculum standards they teach (#114). A learner picks a curriculum on their device (United States or Nigeria) and, optionally, a level; a class can preselect both (#113). Nothing about the choice is sent to the server for storage.

## How it works

- Each lesson concept has a key, `conceptKey(label)` in `@sbi/taxonomy`, which is also its `conceptId`.
- Each standard lists the concept keys it covers. `alignmentsFor(labels, curriculum, { level })` returns the matching standards in level order.
- A concept that contains a known key (for example "static friction" contains "friction") matches as `partial`. Lessons on free subjects (ADR 0013) name concepts in their own words, so this is how they still find standards.

## Curricula

| Curriculum    | Frameworks                                                                                             | Levels                     | Codes                                           |
| ------------- | ------------------------------------------------------------------------------------------------------ | -------------------------- | ----------------------------------------------- |
| United States | NGSS (science), Common Core (maths)                                                                    | 3-5, 6-8, 9-12             | Official, e.g. `MS-PS1-4`, `HSF-IF.A.3`         |
| Nigeria       | NERDC Basic Science and Technology; NERDC Senior Secondary Mathematics, Physics, Chemistry and Biology | P4-6, JSS1–JSS3, SSS1–SSS3 | Ours, e.g. `NG-PHY-SSS2-WAVES-LIGHT-REFRACTION` |

NERDC publishes topics without codes, so the codes are ours: `NG-<subject>-<class>-<theme>-<topic>`. Once published, a code never changes meaning; a renamed topic gets a new code.

## Status and review

- **The alignments are our reading, not an official mapping** from NGSS, Common Core or NERDC.
- **Nigerian class placement needs a teacher's review.** Topics follow the usual scheme of work for SSS1–SSS3, but schools reorder them. The teacher interviews (`docs/research/educators/`) should check them.
- Seed concepts a curriculum doesn't cover are listed in `KNOWN_GAPS` in `packages/taxonomy/src/curriculum/curriculum.test.ts`; any other unmapped concept fails the tests.

## Adding a curriculum

1. Add its id to `Curriculum` in `src/curriculum/schema.ts`.
2. Add a file with its `CurriculumInfo` and standards, and register it in `CURRICULA`.
3. The shared tests then check codes, levels and coverage.
