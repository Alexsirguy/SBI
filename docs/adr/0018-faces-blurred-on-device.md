# 0018. Faces are blurred on the device before upload

- Status: accepted
- Date: 2026-11-01
- Issue: #69

## Context

Spec §12 says we must never identify a person from a photo, and should blur faces where that is feasible and useful. Photos go to our storage and to a vision model for recognition. Blurring on the server would still let both of them see the unblurred face. The owner chose to blur in the browser instead, so no face leaves the device.

## Decision

- **Detection:** the capture page runs MediaPipe's face detector (`@mediapipe/tasks-vision` 1.1.1, Apache-2.0) with the BlazeFace short-range model (`blaze_face_short_range.tflite`, float16 v1, Apache-2.0).
- **When it runs:** on the normalised photo, before cropping. Every copy that is shown, handed to the lesson page or uploaded is therefore already blurred.
- **How faces are hidden:** each detected face, plus a 35% margin, becomes a 6-block mosaic. A mosaic is used rather than a canvas blur filter because Safari lacks canvas filters, and 6 blocks keep no recognisable feature.
- **Assets are served from this site**, so no third-party CDN is involved:
  - The WebAssembly is copied from the npm package into `public/mediapipe/wasm` on `dev` and `build`. It is not committed.
  - The model is committed at `apps/web/public/mediapipe/blaze_face_short_range.tflite`. Its sha256 is `b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f` (229,746 bytes).
- **If the detector can't load or run, the photo is not blocked.** The learner is told it could not be checked for faces, and is asked to choose another photo if anyone is in it.
- **Recognition is guarded on the server too.** The prompt (recognition-p0.3) forbids identifying or describing people. `withoutPeople` drops any candidate whose head noun is a person, and any observation that mentions one. A photo left with no candidates is reported as unsupported.

## Consequences

- **Cost:** the first photo downloads about 13.5 MB of WebAssembly (roughly 4 MB compressed) plus a 230 KB model. Later photos reuse them.
- **Missed faces:** the short-range model is tuned for faces within about 2 m. Small, distant faces in a wide shot can be missed, which is why the upload cue still asks learners to keep people out of the picture.
- **Upgrades:** a new MediaPipe version or model is a new licence and checksum review.
