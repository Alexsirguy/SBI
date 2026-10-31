import type { LessonSection } from "@sbi/contracts";
import type { ReactNode } from "react";
import { MODULE_LABELS } from "./labels";

export const sectionAnchor = (section: Pick<LessonSection, "module">) =>
  `section-${section.module}`;

/** Observation is what the learner can check by looking; inference is the explanation behind it. */
export type Evidence = "observation" | "inference";

const EVIDENCE_LABELS: Record<Evidence, string> = {
  observation: "What you can observe",
  inference: "Explanation",
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
  const headingId = `${sectionAnchor(section)}-heading`;
  return (
    <section
      id={sectionAnchor(section)}
      aria-labelledby={headingId}
      className={`lesson-section${evidence ? ` evidence-${evidence}` : ""}`}
    >
      <p className="module-label">
        {MODULE_LABELS[section.module]}
        {evidence ? <span className="evidence-tag"> · {EVIDENCE_LABELS[evidence]}</span> : null}
      </p>
      <h2 id={headingId}>{section.heading ?? MODULE_LABELS[section.module]}</h2>
      {children}
    </section>
  );
}
