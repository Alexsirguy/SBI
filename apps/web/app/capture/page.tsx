import { CaptureForm } from "./capture-form";
import { PHOTO_RETENTION_DAYS } from "./limits";

export default function CapturePage() {
  return (
    <main>
      <h1>Photograph an object</h1>
      <p>Take a photo of an everyday object, or upload one from your device.</p>
      <section aria-labelledby="privacy-cue">
        <h2 id="privacy-cue">How your photo is handled</h2>
        <ul>
          <li>We use your photo only to recognise the object for your lesson.</li>
          <li>
            It is stored privately on Cloudflare R2 and sent to Meta&apos;s model API for
            recognition. It is never shown to other learners.
          </li>
          <li>
            It is deleted within {PHOTO_RETENTION_DAYS} days, or sooner once recognised, unless you
            choose to keep it.
          </li>
        </ul>
      </section>
      <CaptureForm />
    </main>
  );
}
