import type { Lesson, LessonSection } from "@sbi/contracts";
import type { ReactNode } from "react";
import { CheckThinkingSection } from "./check-thinking";
import { FirstPrinciplesSection } from "./first-principles";
import { GoFurtherSection } from "./go-further";
import { HistorySection } from "./history";
import { HowPartsWorkSection } from "./how-parts-work";
import { SeeingSection } from "./seeing";
import { ShortAnswerSection } from "./short-answer";
import { TryAnIdeaSection } from "./try-an-idea";

/** Picks the component for a section's module; every module has one. */
export function SectionView({
  section,
  lesson,
  objectLabel,
  askQuestion,
}: {
  section: LessonSection;
  lesson: Lesson;
  /** The object the learner confirmed, named in What you're seeing. */
  objectLabel?: string;
  askQuestion?: ReactNode;
}) {
  switch (section.module) {
    case "what-youre-seeing":
      return (
        <SeeingSection
          section={section}
          objectLabel={objectLabel}
          assumptions={lesson.assumptions}
        />
      );
    case "short-answer":
      return <ShortAnswerSection section={section} />;
    case "first-principles":
      return <FirstPrinciplesSection section={section} concepts={lesson.concepts} />;
    case "how-parts-work":
      return <HowPartsWorkSection section={section} />;
    case "try-an-idea":
      return <TryAnIdeaSection section={section} highRisk={lesson.safetyClass === "high"} />;
    case "history":
      return <HistorySection section={section} />;
    case "check-thinking":
      return (
        <CheckThinkingSection
          section={section}
          explanation={
            lesson.sections.find((item) => item.module === "short-answer")?.text ?? lesson.summary
          }
          misconceptions={lesson.misconceptionNotes}
        />
      );
    case "go-further":
      return <GoFurtherSection section={section} askQuestion={askQuestion} />;
  }
}
