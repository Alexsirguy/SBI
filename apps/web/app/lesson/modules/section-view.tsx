import type { Lesson, LessonSection } from "@sbi/contracts";
import { FirstPrinciplesSection } from "./first-principles";
import { SectionFrame } from "./frame";
import { HowPartsWorkSection } from "./how-parts-work";
import { SeeingSection } from "./seeing";
import { ShortAnswerSection } from "./short-answer";

/** Picks the component for a section's module; modules without one yet render plainly. */
export function SectionView({ section, lesson }: { section: LessonSection; lesson: Lesson }) {
  switch (section.module) {
    case "what-youre-seeing":
      return <SeeingSection section={section} />;
    case "short-answer":
      return <ShortAnswerSection section={section} />;
    case "first-principles":
      return <FirstPrinciplesSection section={section} concepts={lesson.concepts} />;
    case "how-parts-work":
      return <HowPartsWorkSection section={section} />;
    default:
      return (
        <SectionFrame section={section}>
          <p>{section.text}</p>
        </SectionFrame>
      );
  }
}
