import type { LessonSection } from "@sbi/contracts";
import { SectionFrame } from "./frame";

/** Module 1: what the learner can see for themselves, kept apart from any explanation. */
export function SeeingSection({ section }: { section: LessonSection }) {
  return (
    <SectionFrame section={section} evidence="observation">
      <p>{section.text}</p>
    </SectionFrame>
  );
}
