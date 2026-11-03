import type { LessonSection } from "@sbi/contracts";
import { useT } from "../../i18n/provider";
import { SectionFrame } from "./frame";

/** Module 1: the subject, what can be seen, and what the lesson assumes about it. */
export function SeeingSection({
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
    <SectionFrame section={section} evidence="observation">
      {objectLabel ? (
        <p>
          <strong>{t("objectLabel")}</strong> {objectLabel}
        </p>
      ) : null}
      <p>{section.text}</p>
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
