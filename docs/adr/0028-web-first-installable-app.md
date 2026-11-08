# 0028. Web first: an installable app, no native clients yet

- Status: accepted
- Date: 2026-11-08
- Issue: #115

## Context

Epic #111 asks whether to build native iOS and Android apps, based on camera and repeat-use data. There is no such data yet: there is no production traffic, and repeat use isn't measurable by design (ADR 0026). Teachers in places with weak connections need lessons that work offline (#116), and the web app already runs the camera, face blur, 3D and simulations in the browser.

## Decision

- **No native apps for now.** We stay on the one web codebase.
- **Make the web app installable.** A web app manifest and a service worker let learners add it to the home screen and open saved lessons offline (#116).
- **Measure the deciding signals.** Every usage event now carries `displayMode` (`browser` or `installed`). The reports and the thresholds that reopen this decision are in `docs/research/native-app/usage-analysis.md`.

## Consequences

- One codebase, one release path and no store review or store children's-app rules.
- iOS limits on web push and storage remain. Saved packs can be evicted if the device runs low on space, so the offline page says so and offers a downloaded file as a backup.
- Camera start is a little slower than native. If camera captures dominate and drop off on low-end phones, the thresholds bring this back.
