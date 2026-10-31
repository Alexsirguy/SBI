import type { LessonSection } from "@sbi/contracts";
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
  return (
    <SectionFrame section={section}>
      {objectLabel ? (
        <p>
          <strong>Object:</strong> {objectLabel}
        </p>
      ) : null}
      <p className="problem-text">{section.text}</p>
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
