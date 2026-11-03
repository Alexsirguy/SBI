import type { LessonSection } from "@sbi/contracts";
import type { ReactNode } from "react";
import { useT } from "../../i18n/provider";
import type { LessonKey } from "../lesson-t";
import { MODULE_LABEL_KEYS } from "./labels";

export const sectionAnchor = (section: Pick<LessonSection, "module">) =>
  `section-${section.module}`;

/** Observation is what the learner can check by looking; inference is the explanation behind it. */
export type Evidence = "observation" | "inference";

const EVIDENCE_LABELS: Record<Evidence, LessonKey> = {
  observation: "evidenceObservation",
  inference: "evidenceInference",
};

// Shared shell, so every module keeps one heading structure and anchor scheme.
export function SectionFrame({
  section,
  evidence,
  children,
}: {
  section: LessonSection;
  evidence?: Evidence;
  children: ReactNode;
}) {
  const t = useT("lesson");
  const headingId = `${sectionAnchor(section)}-heading`;
  const moduleLabel = t(MODULE_LABEL_KEYS[section.module]);
  return (
    <section
      id={sectionAnchor(section)}
      aria-labelledby={headingId}
      className={`lesson-section${evidence ? ` evidence-${evidence}` : ""}`}
    >
      <p className="module-label">
        {moduleLabel}
        {evidence ? (
          <>
            <span className="sbi-visually-hidden">, </span>
            <span className="evidence-tag">{t(EVIDENCE_LABELS[evidence])}</span>
          </>
        ) : null}
      </p>
      <h2 id={headingId}>{section.heading ?? moduleLabel}</h2>
      {children}
    </section>
  );
}
