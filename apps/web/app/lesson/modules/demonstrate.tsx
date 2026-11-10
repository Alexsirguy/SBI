"use client";

import type {
  DemonstrationStep,
  Experiment,
  Formula,
  Lesson,
  LessonSection,
  LessonTask,
} from "@sbi/contracts";
import { Button, VisuallyHidden } from "@sbi/ui";
import { type ReactNode, useState } from "react";
import { useT } from "../../i18n/provider";
import { rich } from "../lesson-t";
import { useExperiment } from "../practice";
import { GuessReveal } from "./activate";
import { KeyIdeas } from "./first-principles";
import { FormulaCard } from "./formula";
import { SectionFrame } from "./frame";

function StepButton({
  step,
  number,
  onShown,
}: {
  step: DemonstrationStep;
  number: number;
  onShown: (message: string) => void;
}) {
  const t = useT("lesson");
  const { controller } = useExperiment({
    controls: step.settings.map((setting) => setting.controlId),
  });
  if (!controller || step.settings.length === 0) return null;
  return (
    <Button
      variant="quiet"
      size="small"
      onClick={() => {
        const applied = controller.apply(step.settings);
        controller.reveal();
        onShown(applied ? t("stepSet", { number }) : t("experimentLoading"));
      }}
    >
      {rich(t("showMe"), {
        step: <VisuallyHidden>{t("showMeStep", { number })}</VisuallyHidden>,
      })}
    </Button>
  );
}

/** Merrill's demonstration: a worked solution the learner can play in the experiment. */
export function DemonstrateSection({
  section,
  concepts,
  guess,
  pictures,
  formulas = [],
  experiment,
}: {
  section: LessonSection;
  concepts: Lesson["concepts"];
  /** A topic's formulas, shown after the experiment so their live values sit near it. */
  formulas?: Formula[];
  experiment?: Experiment;
  /** The activate guess, answered once the demonstration is done. */
  guess?: LessonTask;
  /** The lesson's experiment, drawn between the steps and the key ideas. */
  pictures?: ReactNode;
}) {
  const [shown, setShown] = useState("");
  const steps = section.steps ?? [];
  return (
    <SectionFrame section={section} evidence="inference">
      <p>{section.text}</p>
      {steps.length > 0 ? (
        <ol className="demo-steps">
          {steps.map((step, index) => (
            <li key={index}>
              <p>{step.text}</p>
              <StepButton step={step} number={index + 1} onShown={setShown} />
            </li>
          ))}
        </ol>
      ) : null}
      <p role="status" className="sbi-visually-hidden">
        {shown}
      </p>
      {pictures}
      {formulas.map((formula) => (
        <FormulaCard key={formula.formulaId} formula={formula} experiment={experiment} />
      ))}
      <KeyIdeas concepts={concepts} />
      {guess ? <GuessReveal task={guess} /> : null}
    </SectionFrame>
  );
}
