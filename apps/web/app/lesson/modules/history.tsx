import type { LessonSection } from "@sbi/contracts";
import { SectionFrame } from "./frame";

/** Module 6: always shown (ADR 0011); an unsourced history is covered by the lesson's notice. */
export function HistorySection({ section }: { section: LessonSection }) {
  return (
    <SectionFrame section={section}>
      <p>{section.text}</p>
    </SectionFrame>
  );
}
