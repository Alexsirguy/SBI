"use client";

import type { Lesson, LessonSection, LessonTask } from "@sbi/contracts";
import { Button, RadioGroup } from "@sbi/ui";
import { useEffect, useRef, useState } from "react";
import { CONCEPT_CHECK, topicOf } from "../../analytics/concept-check";
import { track } from "../../analytics/track";
import { useT } from "../../i18n/provider";
import { rich } from "../lesson-t";
import { usePractice } from "../practice";
import { SectionFrame } from "./frame";

/** Merrill's activation: recall something familiar, then commit to a guess before being told. */
export function ActivateSection({
  section,
  task,
  lesson,
}: {
  section: LessonSection;
  /** The lesson's one guess. */
  task?: LessonTask;
  lesson?: Pick<Lesson, "lessonId" | "version" | "taxonomyId">;
}) {
  const t = useT("lesson");
  const { guess, lockGuess } = usePractice();
  const [choice, setChoice] = useState<string>();
  const locked = task && guess !== undefined ? task.options[guess] : undefined;
  return (
    <SectionFrame section={section}>
      <p>{section.text}</p>
      {task ? (
        <div className="practice-task">
          {locked === undefined ? (
            <form
              className="guess"
              onSubmit={(event) => {
                event.preventDefault();
                if (choice === undefined) return;
                lockGuess(Number(choice));
                // The guess is the "before" answer of the concept check (#81).
                if (lesson) {
                  track("concept_check_answered", {
                    lessonId: lesson.lessonId,
                    version: lesson.version,
                    topic: topicOf(lesson.taxonomyId),
                    itemId: task.taskId,
                    instrument: CONCEPT_CHECK,
                    phase: "pre",
                    correct: Number(choice) === task.answerIndex,
                    explanationOpened: false,
                  });
                }
              }}
            >
              <RadioGroup
                legend={task.prompt}
                name={`guess-${task.taskId}`}
                options={task.options.map((option, index) => ({
                  value: String(index),
                  label: option,
                }))}
                value={choice}
                onChange={setChoice}
              />
              <Button type="submit" disabled={choice === undefined}>
                {t("lockGuess")}
              </Button>
            </form>
          ) : null}
          <p role="status" className="guess__locked">
            {locked === undefined ? "" : t("guessLocked", { guess: locked })}
          </p>
        </div>
      ) : null}
    </SectionFrame>
  );
}

/** Closes the demonstration by comparing the learner's guess with what it showed. */
export function GuessReveal({ task }: { task: LessonTask }) {
  const t = useT("lesson");
  const { guess, markRevealSeen } = usePractice();
  const ref = useRef<HTMLDivElement>(null);
  // Whether the answer was read before the closing check changes what that check means.
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          markRevealSeen();
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [markRevealSeen]);
  const answer = task.options[task.answerIndex];
  const right = guess === task.answerIndex;
  return (
    <div ref={ref} className="guess-reveal sbi-card">
      <h3>{t("backToGuess")}</h3>
      <p className="guess-reveal__prompt">{task.prompt}</p>
      {guess === undefined ? (
        <p>{t("noGuess")}</p>
      ) : (
        <p>
          {rich(t(right ? "youGuessedRight" : "youGuessed"), {
            guess: <strong>{task.options[guess]}</strong>,
          })}
        </p>
      )}
      {guess !== undefined && !right ? <p>{task.feedback[guess]}</p> : null}
      <p>{rich(t("theAnswer"), { answer: <strong>{answer}</strong> })}</p>
      <p>{task.feedback[task.answerIndex]}</p>
    </div>
  );
}
