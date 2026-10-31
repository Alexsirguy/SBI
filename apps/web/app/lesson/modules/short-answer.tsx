import type { LessonSection } from "@sbi/contracts";
import { Mark } from "@sbi/ui";
import { SectionFrame } from "./frame";

/** Module 2: the direct answer, highlighted as in the prototype so a skimming reader finds it. */
export function ShortAnswerSection({ section }: { section: LessonSection }) {
  return (
    <SectionFrame section={section} evidence="inference">
      <p className="short-answer">
        <Mark>{section.text}</Mark>
      </p>
    </SectionFrame>
  );
}
