import type { LessonSection } from "@sbi/contracts";
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
  return (
    <SectionFrame section={section} evidence="observation">
      {objectLabel ? (
        <p>
          <strong>Object:</strong> {objectLabel}
        </p>
      ) : null}
      <p>{section.text}</p>
      {assumptions.length > 0 ? (
        <>
          <h3>This lesson assumes</h3>
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
