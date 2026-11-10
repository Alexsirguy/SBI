import type { Lesson, LessonSection } from "@sbi/contracts";
import type { ReactNode } from "react";
import { ActivateSection } from "./activate";
import { ApplySection } from "./apply";
import { CheckThinkingSection } from "./check-thinking";
import { DemonstrateSection } from "./demonstrate";
import { FirstPrinciplesSection } from "./first-principles";
import { GoFurtherSection } from "./go-further";
import { HistorySection } from "./history";
import { HowPartsWorkSection } from "./how-parts-work";
import { IntegrateSection } from "./integrate";
import { ProblemSection } from "./problem";
import { SeeingSection } from "./seeing";
import { ShortAnswerSection } from "./short-answer";
import { TryAnIdeaSection } from "./try-an-idea";

/** Picks the component for a section's module; every module has one. */
export function SectionView({
  section,
  lesson,
  objectLabel,
  askQuestion,
  pictures,
}: {
  section: LessonSection;
  lesson: Lesson;
  /** What the lesson is about, named in What you're seeing. */
  objectLabel?: string;
  askQuestion?: ReactNode;
  /** The lesson's visuals, for the module that draws them inside itself. */
  pictures?: ReactNode;
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
    case "problem":
      return (
        <ProblemSection
          section={section}
          objectLabel={objectLabel}
          assumptions={lesson.assumptions}
        />
      );
    case "activate":
      return (
        <ActivateSection
          section={section}
          task={lesson.tasks.find((task) => task.module === "activate")}
          lesson={lesson}
        />
      );
    case "demonstrate":
      return (
        <DemonstrateSection
          section={section}
          concepts={lesson.concepts}
          guess={lesson.tasks.find((task) => task.module === "activate")}
          pictures={pictures}
          formulas={lesson.formulas}
          experiment={lesson.experiment}
        />
      );
    case "apply":
      return (
        <ApplySection
          section={section}
          tasks={lesson.tasks.filter((task) => task.module === "apply")}
          experiment={lesson.experiment}
          formulas={lesson.formulas}
        />
      );
    case "integrate":
      return <IntegrateSection section={section} title={lesson.title} askQuestion={askQuestion} />;
  }
}
