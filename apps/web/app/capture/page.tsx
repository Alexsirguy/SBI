import { CaptureForm } from "./capture-form";
import { PHOTO_RETENTION_DAYS } from "./limits";
import { ConfirmLesson } from "./confirm/confirm-lesson";

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
            It is stored privately on Cloudflare R2 and never shown to other learners. When photo
            recognition is on, it is sent to Meta&apos;s model API, or to OpenAI&apos;s if Meta is
            unavailable; neither may train on it.
          </li>
          <li>
            It is deleted within {PHOTO_RETENTION_DAYS} days, or sooner once recognised, unless you
            choose to keep it.
          </li>
        </ul>
      </section>
      <CaptureForm />
      <section aria-labelledby="text-entry">
        <h2 id="text-entry">No camera? Describe it instead</h2>
        <ConfirmLesson headingLevel={3} />
      </section>
    </main>
  );
}
