# 0005. Default visual format for lessons

- Status: proposed (load-time evidence in; comprehension evidence pending the E1-5 sessions)
- Date: 2026-10-27
- Issue: #14

## Context

Lessons need visuals that help learners understand a mechanism (§9), on the low-end phones many families use. The prototype's visual lab shows the same idea, bicycle gears with a 2:1 ratio, three ways:

- **SVG:** a labelled diagram with deterministic labels, drawn in code.
- **GLB:** a Three.js 0.170.0 view of a project-made `gears.glb` (139 KB), with orbit controls.
- **Simulation:** a canvas where sliders change the tooth counts and show wheel turns, speed and effort.

Participants see all three in a Latin-square order. Comprehension questions are tied to position rather than format, so each format meets each question equally often.

## Load time on an emulated low-end phone

Chrome DevTools, 4× CPU slowdown, Slow 4G, 360×740 at 2× DPR, served locally. Each run used a fresh isolated browser context, so the cache was cold. Time runs from opening the screen to the first rendered frame (the `visualLoaded` event).

| Run              | Order         | SVG   | Simulation | GLB (cold)                        |
| ---------------- | ------------- | ----- | ---------- | --------------------------------- |
| 1                | glb, sim, svg | 9 ms  | 15 ms      | 3,428 ms                          |
| 2                | svg, glb, sim | 18 ms | 21 ms      | 3,449 ms                          |
| 3                | sim, svg, glb | 9 ms  | 20 ms      | 3,388 ms                          |
| Warm (same page) |               |       |            | 65 ms                             |
| Transfer         |               | 0 KB  | 0 KB       | 343 KB (three.js, loaders, model) |

The SVG and simulation ship inside the lesson page, so they add no extra download. The 3D view costs about 3.4 s and 343 KB the first time, and almost nothing after that.

## Comprehension

Pending. Fill in from `docs/research/usability/e1-5-visual-formats.md`: per format, the share of correct answers and the share of participants who chose it as most helpful.

## Decision (proposed)

1. Every lesson gets an **SVG diagram** as its default visual. It loads instantly, its text labels are deterministic and readable by screen readers (the product guardrail), and it prints.
2. Use a **simulation** where the learner can change a quantity: ratios, temperatures, angles. It costs as little as SVG and lets learners test their own predictions.
3. Offer **3D (GLB)** only on request ("See it in 3D"), loaded lazily after the lesson renders. Restrict it to topics where shape or hidden parts are the point. Keep each model under 150 KB, and fall back to the SVG when WebGL is unavailable.

Revisit point 3 if the sessions show 3D clearly improves comprehension.

Update after first demo feedback: the product owner expected "See it in action" to open a model they could change, not a fixed view. The prototype now has an interactive 3D gear lab that combines points 2 and 3: a code-built model with sliders. It's still loaded only on request. The sessions should test whether it beats the 2D simulation.

## Consequences

- `@sbi/visuals` needs an SVG renderer and a small simulation kit first; the Three.js renderer can wait.
- 3D assets need a rights record and a size budget in the visual manifest.
- Load budgets for E9-7 (device-tier performance) can start from these numbers.
