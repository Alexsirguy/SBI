import type { LessonSection } from "@sbi/contracts";
import { SectionFrame } from "./frame";

/** Module 5: something to try or imagine; on high-risk topics only ever a thought experiment. */
export function TryAnIdeaSection({
  section,
  highRisk,
}: {
  section: LessonSection;
  highRisk: boolean;
}) {
  return (
    <SectionFrame section={section}>
      <p className="try-kind">
        <strong>
          {highRisk ? "Thought experiment: imagine it, do not try it." : "Try it or picture it"}
        </strong>
      </p>
      <p>{section.text}</p>
      {/* Interactive visuals (#96) mount here once the visual platform lands. */}
      <div data-slot="interaction" />
    </SectionFrame>
  );
}
