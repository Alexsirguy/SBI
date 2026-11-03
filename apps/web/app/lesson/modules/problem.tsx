import type { LessonSection } from "@sbi/contracts";
import { useT } from "../../i18n/provider";
import { SectionFrame } from "./frame";

/** Merrill's problem: the real task the lesson builds towards, before any explanation. */
export function ProblemSection({
  section,
  objectLabel,
  assumptions = [],
}: {
  section: LessonSection;
  objectLabel?: string;
  assumptions?: string[];
}) {
  const t = useT("lesson");
  return (
    <SectionFrame section={section}>
      {objectLabel ? (
        <p>
          <strong>{t("objectLabel")}</strong> {objectLabel}
        </p>
      ) : null}
      <p className="problem-text">{section.text}</p>
      {assumptions.length > 0 ? (
        <>
          <h3>{t("lessonAssumes")}</h3>
          <ul className="assumptions">
            {assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </>
      ) : null}
    </SectionFrame>
  );
}
