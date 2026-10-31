# Visual evaluation, 2026-10-31 (#92)

This report evaluates the visuals generated for lessons (ADR 0014) on three measures:

- whether they are made, and are correct;
- whether they fit a slow phone's load budget;
- whether they are accessible.

Comprehension stays pending until the E1-5 sessions, as in ADR 0005.

The raw data:

- `generation-2026-10-31.json`, from `pnpm --filter @sbi/api eval:visuals`, run against a live API.
- `load-budgets-2026-10-31.json`, from `VISUAL_BUDGETS=1 pnpm exec playwright test e2e/visual-budgets.spec.ts --workers=1` in `apps/web`.

## Generation over the seed set

**Setup:**

- **Subjects:** 16 objects from `docs/research/seed-set/v2`, at least one from each of the five categories. The refuse and redirect prompts were left out, because they produce no lesson.
- **Requests:** each was a fresh lesson (`fresh: true`, general audience, plain reading level), with up to 3 running at once.
- **Model:** `muse-spark-1.3`, with visual prompt v5 and playground review v1.

| Seed     | Object           | Kind       | Visual after lesson (s) | Labels | Sliders | Readouts |
| -------- | ---------------- | ---------- | ----------------------- | ------ | ------- | -------- |
| seed-001 | Bicycle          | mechanism  | 27.2                    | 5      | 2       | 2        |
| seed-003 | Electric kettle  | playground | 26.9                    | 3      | 1       | 2        |
| seed-005 | Magnifying glass | none       | 36.1                    | –      | –       | –        |
| seed-006 | Playground swing | mechanism  | 18.1                    | 3      | 1       | 2        |
| seed-007 | Magnetic compass | playground | 24.6                    | 5      | 3       | 2        |
| seed-010 | Honeycomb        | playground | 43.6                    | 4      | 2       | 2        |
| seed-011 | Sunflower        | playground | 25.7                    | 5      | 3       | 2        |
| seed-017 | Leaf             | process    | 11.9                    | 6      | 3       | 2        |
| seed-020 | Honey bee        | playground | 16.8                    | 6      | 3       | 2        |
| seed-022 | Cactus           | graph      | 7.5                     | 0      | 3       | 2        |
| seed-024 | Rusty nail       | playground | 17.6                    | 6      | 3       | 2        |
| seed-026 | Ice cubes        | playground | 35.9                    | 4      | 3       | 2        |
| seed-028 | Salt crystals    | playground | 19.8                    | 4      | 2       | 2        |
| seed-030 | Soap bubble      | playground | 20.2                    | 6      | 2       | 2        |
| seed-032 | Acoustic guitar  | playground | 34.6                    | 3      | 3       | 2        |
| seed-035 | Drum             | playground | 20.3                    | 4      | 3       | 2        |

### Results

- **Success:** 15 of 16 lessons (94%) got a visual. 7 of those needed the one repair attempt, according to the API log.
- **Correctness:** the one failure was the magnifying glass. The playground review **caught a physics error twice**: the refracted central ray missed the drawn eye, and the code broke when the object sat at or beyond the focal length. The lesson shipped without a visual, as ADR 0014 intends.
- **Labels:** every label in all 15 visuals cites a claim in its own lesson. The generator drops any that don't.
- **Running:** all 12 stored playgrounds (the 11 above plus the earlier rainbow) load from `GET /playgrounds` and draw without a script error in headless Chromium.
- **Time:** the visual arrives a median of **22 s** after the lesson text (range 7.5 to 43.6 s), while the learner is already reading.

### Finding: the fallback is chosen too often

11 of 16 visuals were playgrounds, although ADR 0014 makes the playground the last resort. Some of these choices are sound:

- Salt and rust are ionic or polymeric. PubChem has no 3D structure for them, so the `molecule` kind would fail.
- The honeycomb and sunflower are geometry, which no other format draws.

Others had a better kind available:

| Subject         | Better kind                               |
| --------------- | ----------------------------------------- |
| Kettle          | The heating `graph`                       |
| Guitar and drum | A `graph` of pitch against length or size |
| Ice             | A `molecule` of water                     |

**Follow-up:**

- Strengthen the prompt's order of kinds, and say which molecules PubChem can't model.
- Add a graph example of pitch.
- Measure the mix again with this script.

## Load budgets on a slow phone

**Device:** 360×740 at 2×, 4× CPU slowdown, Chrome's Slow 4G profile, cold cache. Each kind was measured alone with `/visuals?kind=…`. The timer starts when the figure is on screen, or at the tap for kinds that load on request.

| Kind       | Loads     | Downloaded | First draw |
| ---------- | --------- | ---------- | ---------- |
| playground | with page | 215 KB     | 2.0 s      |
| molecule   | with page | 375 KB     | 4.0 s      |
| graph      | with page | 508 KB     | 4.5 s      |
| process    | on tap    | 860 KB     | 9.0 s      |
| mechanism  | on tap    | 3,113 KB   | 20.9 s     |

- **Light kinds:** they draw within 4.5 s, next to ADR 0005's 3.4 s for a GLB model. Each also carries about 170 KB of the full `mathjs` build used by the common layer. **Follow-up:** build mathjs from only the functions formulas may use.
- **Mechanism:** MuJoCo takes about 21 s on Slow 4G. That is why it loads only on tap, is skipped on Save-Data and on phones with 2 GB of memory or less (#89), and shows the text fallback while it loads. On Wi-Fi it is a few seconds.
- **Process:** Mermaid is the second-heaviest kind. A lighter flowchart renderer would bring it in line with the light kinds.

## Accessibility

- **axe:** every gallery kind passes with the WCAG 2.2 AA rules. It passed in the CI gallery tests, and again on the slow phone above.
- **The common layer gives every kind:**
  - a labelled figure with a text description;
  - native range sliders with units and `aria-valuetext`;
  - live readouts;
  - a parts key;
  - the simplifications.
- **Reduced motion:** every kind starts still, with Play, Turn or Step buttons (#89).
- **No WebGL:** the 3D kinds fall back to text, which is tested in its own Chromium launch.

## Phase 2 gate evidence (milestone "P2 Visual Lab")

| Gate condition                | Evidence                                                                                                             | Status                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Load budgets met              | Light kinds draw within 4.5 s on a slow phone; heavy ones load on tap with a fallback                                | Met, with two follow-ups (mathjs, Mermaid) |
| Accessibility budgets met     | axe clean for every kind; keyboard, reduced motion and no-WebGL paths tested                                         | Met                                        |
| Visuals improve comprehension | Needs the E1-5 sessions, now with generated visuals                                                                  | Pending                                    |
| Visuals are correct           | 94% made; the review caught a real optics error; labels cite their own lesson; reference visuals pass textbook tests | Met for generation; comprehension pending  |
