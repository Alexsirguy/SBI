import type { LessonSection } from "@sbi/contracts";
import { SectionFrame } from "./frame";
import { steps } from "./order";

/** Module 4: how the parts work, as a numbered cause-and-effect sequence. */
export function HowPartsWorkSection({ section }: { section: LessonSection }) {
  const sequence = steps(section.text);
  return (
    <SectionFrame section={section} evidence="inference">
      {sequence.length > 1 ? (
        <ol className="causal-steps">
          {sequence.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      ) : (
        <p>{section.text}</p>
      )}
    </SectionFrame>
  );
}
