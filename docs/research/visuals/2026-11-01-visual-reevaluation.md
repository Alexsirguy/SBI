# Visual re-evaluation, 2026-11-01 (#315)

This reruns the [2026-10-31 evaluation](2026-10-31-visual-evaluation.md) with lessons that follow Merrill's First Principles (ADR 0017). It uses visual prompt v7 and draft prompt v7.

Each lesson now declares an experiment, meaning the sliders and readouts its challenges use, and the visual must offer those ids. This run measures that, along with the mix of kinds.

The raw data is in `generation-2026-11-01.json`, from `pnpm --filter @sbi/api eval:visuals`, run against a live API.

**Setup:** the same 16 seed objects, each a fresh lesson (general audience, plain reading level), up to 3 at once, on `muse-spark-1.3`.

## Results

| Measure                                        | 2026-10-31   | 2026-11-01                |
| ---------------------------------------------- | ------------ | ------------------------- |
| Lessons with a visual                          | 15 of 16     | 15 of 16                  |
| Playgrounds                                    | 11           | 8                         |
| Graphs                                         | 1            | 6                         |
| Mechanisms                                     | 2            | 1                         |
| Processes                                      | 1            | 0                         |
| Visuals offering every experiment id           | not measured | **15 of 15** (target 80%) |
| Challenges the learner can check in the visual | not measured | **31 of 33**              |
| Lesson arrives (median, 3 at once)             | not measured | 41.9 s                    |
| Visual arrives after the lesson (median)       | 22 s         | 21.8 s                    |

The two challenges that cannot use a visual belong to the leaf, which got none. They fall back to multiple choice.

| Seed     | Object           | 2026-10-31 | 2026-11-01 | Sections left unverified |
| -------- | ---------------- | ---------- | ---------- | ------------------------ |
| seed-001 | Bicycle          | mechanism  | graph      | demonstrate              |
| seed-003 | Electric kettle  | playground | playground | –                        |
| seed-005 | Magnifying glass | none       | playground | apply                    |
| seed-006 | Playground swing | mechanism  | mechanism  | –                        |
| seed-007 | Magnetic compass | playground | playground | demonstrate              |
| seed-010 | Honeycomb        | playground | playground | demonstrate, apply       |
| seed-011 | Sunflower        | playground | playground | apply                    |
| seed-017 | Leaf             | process    | none       | demonstrate              |
| seed-020 | Honey bee        | playground | playground | demonstrate              |
| seed-022 | Cactus           | graph      | graph      | apply                    |
| seed-024 | Rusty nail       | playground | graph      | –                        |
| seed-026 | Ice cubes        | playground | playground | demonstrate              |
| seed-028 | Salt crystals    | playground | playground | –                        |
| seed-030 | Soap bubble      | playground | graph      | –                        |
| seed-032 | Acoustic guitar  | playground | graph      | apply                    |
| seed-035 | Drum             | playground | graph      | –                        |

## Findings

**Experiment ids hold.** Every visual offered every control and readout its lesson named. Challenges therefore run in the visual, not as multiple choice.

**Graphs replace weak playgrounds.** The guitar, drum, rust and soap bubble moved to graphs, as the 2026-10-31 report asked. The remaining playgrounds are mostly topics no other kind draws: light, geometry, magnetic fields and crystal lattices.

The electric kettle is the one clear miss. Its heating curve is a graph, and the prompt's own example is a kettle.

**The leaf had no visual, by design.** Its playground drew the oxygen arrow into the leaf and showed gases flowing with no sunlight. The playground review rejected it twice, so the lesson shipped without a picture rather than with a wrong one.

**Ice is a playground, not a molecule.** #220 asked for a water molecule. Since ADR 0017, though, each lesson needs an experiment the learner can drive, and a molecule viewer has no sliders. A playground of density against temperature serves the lesson's challenges, so this check from #220 no longer applies.

**Verification is the weak spot.** Only 6 of 16 lessons were fully verified. demonstrate was left unverified in 6 lessons and apply in 5. These lessons are served with a notice naming those sections (ADR 0010). Raising this rate is lesson work, outside the visuals epic.

## Follow-ups

- Kettle: steer heating topics to the graph kind.
- Raise the share of fully verified lessons. The entailment failures are mostly true but uncited details in demonstrate's steps and in the challenge feedback.
