"use client";

export function ConfirmStart({
  subject,
  onConfirm,
  onBack,
}: {
  subject: string;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <section aria-label="Confirm lesson start">
      <h2>Start this lesson?</h2>
      <p>{subject}</p>
      <button type="button" onClick={onConfirm}>
        Start lesson
      </button>
      <button type="button" onClick={onBack}>
        Choose again
      </button>
    </section>
  );
}
