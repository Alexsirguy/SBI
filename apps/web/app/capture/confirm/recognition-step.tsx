"use client";

import type { ApiResponse, Certainty } from "@sbi/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { lessonHref } from "../../lesson/lesson-request";
import { readPrefs } from "../../lesson/prefs";
import { DescribeForm } from "./describe-form";

const CERTAINTY_WORDS: Record<Certainty, string> = {
  likely: "likely",
  possible: "possible",
  unsure: "less likely",
};

const NOTHING_SEEN =
  "We couldn't tell what this is. Tell us what it is, or try a photo of an everyday object, close up and in good light.";

/** The prototype's choice step: what it could be, in the model's words, or the learner's own. */
export function RecognitionStep({
  reply,
  error,
  onStart,
  onRetake,
}: {
  reply?: ApiResponse<"recognisePhoto">;
  error?: string;
  /** Hands the photo on to the lesson page before it opens, for lessons about this label only. */
  onStart: (label: string) => void;
  onRetake: () => void;
}) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const options = reply?.options ?? [];

  // The loader that held focus is gone, so the learner lands on the question being asked.
  useEffect(() => headingRef.current?.focus(), []);

  function start(label: string) {
    onStart(label);
    router.push(lessonHref({ label }, { prefs: readPrefs() }));
  }

  return (
    <section aria-labelledby="choices-heading" className="photo-choices">
      <h2 id="choices-heading" ref={headingRef} tabIndex={-1}>
        {options.length > 0 ? "Which one is it?" : "What is in your photo?"}
      </h2>
      {options.length > 0 ? (
        <>
          <p>We can see a few possibilities. Pick the one that matches.</p>
          <ul className="choice-list">
            {options.map((option) => (
              <li key={option.label}>
                <button type="button" className="choice" onClick={() => start(option.label)}>
                  <span>{option.label}</span>
                  <small>{CERTAINTY_WORDS[option.certainty]}</small>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p role="status" className="photo-choices__message">
          {error ?? NOTHING_SEEN}
        </p>
      )}
      <DescribeForm
        label="Something else? Tell us what it is"
        hint=""
        submitLabel="Use this"
        onStart={onStart}
      />
      <button type="button" className="back-link" onClick={onRetake}>
        Try a different photo
      </button>
    </section>
  );
}
