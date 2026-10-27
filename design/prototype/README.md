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
