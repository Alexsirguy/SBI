"use client";

import type { LessonSection } from "@sbi/contracts";
import { useId, useRef, useState } from "react";
import { SectionFrame } from "./frame";

/** Module 7: a question to reason through, then an explanation; no score, timer or streak. */
export function CheckThinkingSection({
  section,
  explanation,
  misconceptions,
}: {
  section: LessonSection;
  /** The lesson's own answer, shown after the learner has had a go. */
  explanation: string;
  misconceptions: string[];
}) {
  const answerId = useId();
  const hintId = useId();
  const [revealed, setRevealed] = useState(false);
  const feedbackRef = useRef<HTMLDivElement>(null);
  return (
    <SectionFrame section={section}>
      <p>{section.text}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setRevealed(true);
          requestAnimationFrame(() => feedbackRef.current?.focus());
        }}
      >
        <label htmlFor={answerId}>Your thinking (optional, not saved or marked)</label>
        <textarea id={answerId} rows={3} aria-describedby={hintId} />
        <p id={hintId} className="hint">
          Take your time. There is no score and no timer.
        </p>
        <button type="submit">Compare with the explanation</button>
      </form>
      {revealed ? (
        <div ref={feedbackRef} tabIndex={-1} className="check-feedback">
          <h3>The explanation</h3>
          <p>{explanation}</p>
          {misconceptions.length > 0 ? (
            <>
              <h3>A common mix-up</h3>
              <ul>
                {misconceptions.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </SectionFrame>
  );
}
