import type { LessonSection } from "@sbi/contracts";
import { SectionFrame } from "./frame";

/** Module 2: the direct answer, set apart so a skimming reader finds it. */
export function ShortAnswerSection({ section }: { section: LessonSection }) {
  return (
    <SectionFrame section={section} evidence="inference">
      <p className="short-answer">
        <strong>{section.text}</strong>
      </p>
    </SectionFrame>
  );
}
