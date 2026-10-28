import { CaptureForm } from "./capture-form";

export default function CapturePage() {
  return (
    <main>
      <h1>Photograph an object</h1>
      <p>Take a photo of an everyday object, or upload one from your device.</p>
      <section aria-labelledby="privacy-cue">
        <h2 id="privacy-cue">How your photo is handled</h2>
        <p>
          Photos are used only to recognise the object for your lesson. They are stored privately,
          never shown to other learners, and deleted automatically afterwards.
        </p>
      </section>
      <CaptureForm />
    </main>
  );
}
