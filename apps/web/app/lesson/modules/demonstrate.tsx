"use client";

import type { DemonstrationStep, Lesson, LessonSection, LessonTask } from "@sbi/contracts";
import { Button, VisuallyHidden } from "@sbi/ui";
import { type ReactNode, useState } from "react";
import { useExperiment } from "../practice";
import { GuessReveal } from "./activate";
import { KeyIdeas } from "./first-principles";
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
        onShown(
          applied
            ? `Step ${number} is set in the experiment.`
            : "The experiment is still loading. Try again in a moment.",
        );
      }}
    >
      Show me<VisuallyHidden> step {number}</VisuallyHidden>
    </Button>
  );
}

/** Merrill's demonstration: a worked solution the learner can play in the experiment. */
export function DemonstrateSection({
  section,
  concepts,
  guess,
  pictures,
}: {
  section: LessonSection;
  concepts: Lesson["concepts"];
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
      <KeyIdeas concepts={concepts} />
      {guess ? <GuessReveal task={guess} /> : null}
    </SectionFrame>
  );
}
