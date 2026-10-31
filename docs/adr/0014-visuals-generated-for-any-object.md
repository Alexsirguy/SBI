# 0014. Visuals generated for any object

- Status: accepted
- Date: 2026-10-31
- Issue: #292
- Amends: ADR 0005 (default visual format); the "never generate new visual assets" rule in #96 and the prototype README

## Context

Learners can photograph or name anything (ADR 0013). The visual plan before this, from epic #83 and ADR 0005, assumed a fixed set of hand-built visuals:

- curated diagrams,
- a few tested simulations,
- three curated GLB models.

The prototype followed the same rule: live lessons chose one of four interactive models (gears, piston engine, lever, heating) and never drew their own. A fixed set cannot keep up with "any object". Most lessons would have no visual at all.

The owner's decision (2026-10-31): every lesson should come with a visual and a simulation playground generated for its own object, using third-party libraries where they help.

Two ways to generate them were weighed:

- **The AI writes code.** Anything can be shown, but the code is hard to check for correctness or accessibility, and it has to be isolated.
- **The AI writes a spec that we render.** It is safe, consistent and checkable, but it can only show what the spec describes.

Several mature spec formats exist already, and AI models write them well. So we adopt those, and keep code for the topics they can't describe.

## Decision

**The AI picks one format for the object and writes its spec. We validate the spec and render it with existing libraries. AI-written code in a sandbox is the fallback.**

| Kind         | The AI writes                                   | We validate with                                                    | We render with                   | Licence                 |
| ------------ | ----------------------------------------------- | ------------------------------------------------------------------- | -------------------------------- | ----------------------- |
| `mechanism`  | MuJoCo MJCF XML                                 | `@mujoco/mujoco` on the server: it loads, it moves, no NaN, bounded | MuJoCo WASM with three.js        | Apache-2.0, MIT         |
| `molecule`   | Molecule names                                  | PubChem returns a computed 3D conformer (SDF)                       | 3Dmol.js                         | NCBI data policy, BSD-3 |
| `process`    | Mermaid text                                    | `mermaid.parse`                                                     | Mermaid, `securityLevel: strict` | MIT                     |
| `graph`      | Vega-Lite spec, with formulas as mathjs strings | Vega-Lite JSON schema; mathjs parse                                 | vega-embed                       | BSD-3, Apache-2.0       |
| `playground` | A JS module that uses only the SBI kit          | acorn static check and a checker model pass                         | Sandboxed iframe                 | Project output          |

- **Mechanisms** cover engines, gears, levers, hinges, pumps, springs and pendulums.
- **Molecules** cover water, salt, caffeine and plastics.
- **Processes** cover cycles and stages such as photosynthesis, the four strokes and the water cycle.
- **Graphs** cover quantities over time or against each other.
- **Playgrounds** cover light, heat, particles, weather and anything else the formats can't describe.

### The common layer is ours

The AI fills in the same layer for every kind, and our renderer draws it, so no visual can leave it out:

- **Labels**, each tied to a claim ID in the lesson; a label with no claim is dropped.
- **Sliders**, each mapped to a value in the spec, with a unit, min, max and step.
- **Readouts** calculated by mathjs, which evaluates arithmetic and cannot run code.
- **Assumptions**, shown beside the controls (for example "One cylinder, no friction").
- **A text description** for screen readers, which is also the fallback when the visual can't load.
- **Reduced motion**: every kind starts still under `prefers-reduced-motion`, and offers step buttons instead of continuous motion.

### Generation and checks

1. The visual is generated after the lesson is published, so the text never waits for it. It arrives on the lesson's `visuals` stream event.
2. Validation failures go back to the AI once for repair. If the repair fails, the AI tries the `playground` fallback. If that fails too, the lesson ships without a visual. A lesson is never held for its visual (ADR 0011).
3. The manifest is stored with its sha256 and served at `GET /visuals/{id}`. It is cached per subject, age and depth, as lessons are.
4. The lesson notes that the visual was made by AI for this lesson and is simplified, and lists its assumptions.

### The playground sandbox

- **How it is served:** the API serves the playground document, not the web origin, with a header CSP:
  - `sandbox allow-scripts`
  - `default-src 'none'`
  - `script-src` limited to the kit's hashed URL
  - `connect-src 'none'`
- **How it is mounted:** in an `<iframe sandbox="allow-scripts">` without `allow-same-origin`, so the frame has an opaque origin. It cannot reach the page, cookies or storage, and it has no network access.
- **What the code may use:** the SBI kit, a pinned and self-hosted bundle of three.js, matter-js, mathjs and the common-layer helpers. The static check rejects:
  - network APIs, `eval`, `Function` and dynamic `import()`;
  - access to `parent`, `top` or storage;
  - code over the size limit.
- **Messages to the page:** only `ready`, `error`, `height` and `labChange`, each checked against a schema and its source window.

### Loading

The figures below are gzipped, measured from the published packages on 2026-10-31.

| Renderer   | Download         | When it loads                    |
| ---------- | ---------------- | -------------------------------- |
| vega-embed | 21 KB, plus vega | With the visual                  |
| 3Dmol.js   | 156 KB           | With the visual                  |
| three.js   | about 190 KB     | With a 3D visual                 |
| Mermaid    | about 980 KB     | Only on tap, then cached         |
| MuJoCo     | 2.7 MB           | Only on tap ("See it in action") |

- MuJoCo and Mermaid are too large for slow phone connections, so they load only when the learner asks. The owner chose to keep full MuJoCo, rather than a lighter engine, on that condition.
- Until the renderer loads, and whenever Save-Data is on or WebGL is missing, the learner sees the labelled description and the assumptions.
- The heavy files are served from our own origin with immutable caching.

## Consequences

- Any object can get a visual. Mechanisms, molecules, processes and graphs use formats with well-tested renderers, and we can check them before anyone sees them.
- Labels, units, assumptions and descriptions are always present, because the renderer adds them.
- Generated visuals can still be wrong in ways the checks miss. The disclaimer says so, and the evaluation in #92 measures how often.
- The first mechanism visual costs 2.7 MB. That is fine on Wi-Fi and slow on mobile data, and the fallback covers the wait.
- The sandbox is the riskiest part, so it gets escape tests (#90) and stays the last resort.
- The curated GLB lessons (#87) become a curated set of reference visuals used as examples and regression fixtures. #96's tutor actions select states of the lesson's generated visual.
- Every library above needs an entry in the rights register (#72) before visuals can be published.
