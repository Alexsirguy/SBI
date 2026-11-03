"use client";

import type { LessonSection } from "@sbi/contracts";
import { Button, TextArea } from "@sbi/ui";
import { useRef, useState } from "react";
import { useT } from "../../i18n/provider";
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
  const t = useT("lesson");
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
        <TextArea label={t("yourThinking")} rows={3} hint={t("noScoreHint")} />
        <Button type="submit">{t("compareExplanation")}</Button>
      </form>
      {revealed ? (
        <div ref={feedbackRef} tabIndex={-1} className="check-feedback sbi-card">
          <h3>{t("theExplanation")}</h3>
          <p>{explanation}</p>
          {misconceptions.length > 0 ? (
            <>
              <h3>{t("commonMixUp")}</h3>
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
