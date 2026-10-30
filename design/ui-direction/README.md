# Workbench: proposed design direction (E15-1, #254)

`index.html` is one static, clickable page. As with `design/prototype/`, there is no build step:

```sh
python3 -m http.server 8766 --directory design/ui-direction   # then open http://localhost:8766/
```

It shows:

- **The rules:** five rules the direction keeps everywhere.
- **The tokens:** colour in light and dark, type scale, spacing, radius, touch size and motion.
- **A phone walk-through:** Home → Capture (quality checks) → Confirm (with an optional question) → Loading (quick answer first) → Lesson → Check your thinking and feedback.
- **The desktop reader:** a fixed section list, a reading column, and a margin for notes, depth and sources.

## Why this direction

It grows out of the Phase 0 prototype, so learners who tried that will recognise it. It keeps the bench, paper, teal and highlighter, and the Atkinson Hyperlegible and Bricolage Grotesque typefaces. It also follows what the spec asks for: a concise entry point with depth on request, no childish tone, read-aloud friendly, and colour never the only signal.

The five rules:

1. Teal means "press me", and only that.
2. The highlighter marks one thing: the answer, and quoted evidence.
3. Every signal is also a word and a shape: safety, notes, observation versus explanation, and claim status.
4. Text comes first and is always readable: 17px Atkinson Hyperlegible on a 65-character measure.
5. Grown-up, not childish: no mascots, confetti or streaks. Progress is shown, not rewarded.

## Next step

Once the owner approves, or asks for changes, the agreed version becomes CSS tokens and components in `packages/ui` (E15-2). The capture and reader polish (E15-3 and E15-4) then build on those.
