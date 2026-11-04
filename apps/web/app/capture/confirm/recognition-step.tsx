"use client";

import type { ApiResponse, Certainty } from "@sbi/contracts";
import { useEffect, useRef, useState } from "react";
import { track } from "../../analytics/track";
import { useT } from "../../i18n/provider";
import type { CaptureKey } from "../messages";
import { DescribeForm } from "./describe-form";
import { QuestionStep } from "./question-step";

const CERTAINTY_WORDS: Record<Certainty, CaptureKey> = {
  likely: "certaintyLikely",
  possible: "certaintyPossible",
  unsure: "certaintyUnsure",
};

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
  const t = useT("capture");
  const [chosen, setChosen] = useState<string>();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const options = reply?.options ?? [];

  // The loader, or the question step, that held focus is gone, so the learner lands on this one.
  useEffect(() => {
    if (!chosen) headingRef.current?.focus();
  }, [chosen]);

  // No lesson is written until the learner says what they want to know about it.
  if (chosen) {
    return <QuestionStep label={chosen} onStart={onStart} onBack={() => setChosen(undefined)} />;
  }

  return (
    <section aria-labelledby="choices-heading" className="photo-choices">
      <h2 id="choices-heading" ref={headingRef} tabIndex={-1}>
        {options.length > 0 ? t("whichOne") : t("whatInPhoto")}
      </h2>
      {options.length > 0 ? (
        <>
          <p>{t("possibilities")}</p>
          <ul className="choice-list">
            {options.map((option, rank) => (
              <li key={option.label}>
                <button
                  type="button"
                  className="choice"
                  onClick={() => {
                    track("recognition_confirmed", { rank, certainty: option.certainty });
                    setChosen(option.label);
                  }}
                >
                  <span>{option.label}</span>
                  <small>{t(CERTAINTY_WORDS[option.certainty])}</small>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p role="status" className="photo-choices__message">
          {error ?? t("nothingSeen")}
        </p>
      )}
      <DescribeForm
        label={t("somethingElse")}
        hint=""
        submitLabel={t("useThis")}
        onName={(name) => {
          track("recognition_corrected", { correctionClass: "described" });
          setChosen(name);
        }}
      />
      <button type="button" className="back-link" onClick={onRetake}>
        {t("tryDifferentPhoto")}
      </button>
    </section>
  );
}
