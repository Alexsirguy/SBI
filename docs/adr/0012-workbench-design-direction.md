# 0012. Workbench design direction

- Status: accepted (owner approval, 2026-10-30)
- Date: 2026-10-30
- Issue: #254 · Epic: #253
- Prototype: `design/ui-direction/`

## Context

Capture and lesson worked end to end, but they were unstyled HTML. The spec asks for:

- a concise entry with expandable depth, and no childish tone (§1);
- a readable, read-aloud-friendly lesson (§5);
- colour never as the sole encoding, plus keyboard, mobile and reduced-motion support (§12, §14).

The Phase 0 prototype had already tested a look with learners: bench, paper, teal, highlighter, Atkinson Hyperlegible and Bricolage Grotesque.

## Decision

The product uses the **Workbench** direction. The object sits on the bench; the lesson is a clean page of notes beside it. The tokens live in `@sbi/ui/tokens.css`, all prefixed `--sbi-`, with a light palette and a separate dark one. Five rules hold everywhere:

1. **Teal (`--sbi-action`) means "press me", and only that.** Information never uses it.
2. **The highlighter (`--sbi-marker`) marks one thing:** the quick answer, and quoted evidence. Highlighted text is a full fill and always uses `--sbi-marker-ink`, because light text on the highlighter fails contrast in dark mode.
3. **Every signal is also a word and a shape.** Safety, notes, observation versus explanation, and claim status each carry a label and a distinct rule (solid, dashed or double), never colour alone.
4. **Text first.** Atkinson Hyperlegible at 17px on a 65-character measure, with headings in Bricolage Grotesque.
5. **Grown-up, not childish.** No mascots, confetti or streaks. Progress is shown, not rewarded.

Rules for the tokens:

- **Contrast:** every text pair reaches WCAG AA 4.5:1 and every control edge, focus ring or state stripe 3:1, in both themes. `packages/ui/src/tokens.test.ts` enforces this.
- **Field borders:** form fields use `--sbi-control-edge`, not `--sbi-rule`, which is too faint for 1.4.11.
- **Touch targets:** at least 44px, and 48px for buttons.
- **Motion:** 150–350ms with one easing curve, and zero under `prefers-reduced-motion`.

## Consequences

- One source for colour and type. Components (E15-2) and screens (E15-3 and E15-4) take every value from the tokens.
- Fonts are self-hosted by the web app at build time, so learners' browsers never contact a font host.
- Any change to a colour must keep `tokens.test.ts` passing in both themes.
