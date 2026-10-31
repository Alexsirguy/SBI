# Clickable prototype (E1-3, E1-4, E1-5)

`index.html` is the whole prototype: one static file with no build step. Open it locally, or use the GitHub Pages copy that `.github/workflows/pages.yml` publishes on every push to `main` (enable Pages with source "GitHub Actions" in repo settings first).

```sh
python3 -m http.server 8765 --directory design/prototype   # then open http://localhost:8765/?facilitator=1
```

## Modes

- **Demo (default):** four sample photos covering each path:
  - bicycle: confident
  - shiny pot: ambiguous between kettle, teapot and coffee pot
  - leaf: confident
  - tablets: unsupported, with a safe redirect

  Recognition results and lessons come from the `demo-data` JSON block in the page.

- **Live:** in the session panel, choose Live and paste a Meta Model API key. Real photos are downscaled to 768 px and sent to `https://api.meta.ai/v1/chat/completions` (default model `muse-spark-1.3`), using the same prompt as `@sbi/recognition`.
  - The key stays in `sessionStorage` for that tab only. Use a Standard-mode key, never a `-contributor` model.
  - Meta advises against keys in client code, so use live mode only on a facilitator's device, never on a link shared with participants.

## Lessons

Lessons teach from first principles. Each lesson opens with what's in the photo and the short answer, then **Show me why** builds that answer step by step:

1. Start from basic truths the learner already trusts or can check, such as "energy isn't created" or "water is made of moving particles".
2. Reason through the object's parts, one small step at a time. Most steps ask the learner to guess what follows before showing the answer.
3. **Put it together** gives the answer again, this time as the conclusion of the steps.
4. Then come a test to try at home, a new situation to apply the idea to, how someone first worked it out, and where to go further.

Evidence sits behind **How do we know?** under each step, and opens only after the learner has guessed.

- **Lesson structure:** each demo topic (bicycle, kettle, leaf) has 11–12 steps at three depths, and each step is tagged with one of the 8 Lesson contract modules. Every topic also has a one-question concept check before and after the lesson.
- **Prepared lessons:** written by hand and checked against the cited sources. Every question for a topic leads to the same lesson.
- **Live lessons:** in live mode, any other object or question gets a lesson written by Meta's model in the same step structure, using the `lesson-p0.4` prompt from `@sbi/benchmark`. Its safety gate redirects risky questions.
  - The model writes each guess's correct and wrong answers as text, and the page places them. Models often mark the wrong option when they number answers themselves.
  - While the learner answers the pre-lesson question, a second call checks each guess's options answer its question and the marked answer is right. A guess that fails is shown as a plain explanation instead (logged as `guessCheck`).
  - The model also picks one interactive model from the kit below, or none. The page puts its **See it in action** button on the lesson's first parts step.
- **Variant:** the session panel switches between A (guess at each step) and B (the same steps with each answer shown, no guessing), to test whether predicting helps.

## Interactive models (first demo kit)

**See it in action** opens one of four models. Each has sliders and buttons, live readouts, and a line saying what it simplifies. Slider changes are logged as `labChange`.

| Model               | Used by                                | What you can change                                                                                                     |
| ------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Gears (3D)          | Bicycle, "Count the teeth"             | Front and back teeth and pedalling speed; **Turn the pedals once**, **Keep pedalling**, and presets for hills and speed |
| Piston engine       | Live lessons, for example "car engine" | Engine speed and accelerator; **Next stroke** steps through intake, compression, power and exhaust                      |
| Lever               | Live lessons, for example "seesaw"     | Load and both distances from the pivot; **Lift the load 10 cm** shows the trade between force and distance              |
| Heating and boiling | Kettle, "Why it stays at 100 °C"       | Heater power, amount of water and height above the sea; a temperature graph flattens at the boiling point               |

Live lessons choose from this fixed list and never draw a visual of their own. This kit is a stand-in: [ADR 0014](../../docs/adr/0014-visuals-generated-for-any-object.md) replaces it with a visual generated for each object, and these four models become its reference examples (#87).

### Gears

The model is built in code with Three.js, so it works from the single HTML file. If Three.js can't load, the numbers still work. Slider changes log `labChange`, and the two buttons log `labTurnOnce` and `labRun`.

## Comparing visual formats

For the E1-5 sessions, **Compare ways of seeing it** on the result screen shows the same idea three ways:

- a labelled SVG diagram
- a Three.js view of `gears.glb`
- a simulation with tooth-count sliders.

Each format logs its load time and the answer to a comprehension question. If `gears.glb` can't be fetched (the page was opened from disk, or the file wasn't uploaded), the 3D view builds the same gears in code, and facilitator mode says so.

The order comes from a Latin square based on the participant number; the session panel can override it. Load times show only in facilitator mode. To regenerate the model, open `tools/make-gears-glb.html` through the local server and click **Download gears.glb**.

## Facilitator mode

Add `?facilitator=1` to the URL to show the **Session** button. In the panel:

- set the participant code and segment
- switch mode
- view the event log
- export it as JSON or CSV for the notes template in `docs/research/interviews/`.

The log records taps, screens, timings, confirmations and quiz answers. It never stores photos or free text; for corrections it records only the length. Sessions are kept in `localStorage` until **New session**.

## Content and rights

- Sample photos are inline SVG illustrations drawn for this prototype, so there are no third-party rights.
- See [CREDITS.md](CREDITS.md) for fonts and libraries.
