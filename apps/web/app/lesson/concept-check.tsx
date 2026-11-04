"use client";

import type { Lesson } from "@sbi/contracts";
import { Button, RadioGroup } from "@sbi/ui";
import { useId, useState } from "react";
import { CONCEPT_CHECK, topicOf } from "../analytics/concept-check";
import { track } from "../analytics/track";
import { useT } from "../i18n/provider";
import { rich } from "./lesson-t";
import { usePractice } from "./practice";

/**
 * The "after" half of the concept check (#81): the opening guess asked again at the end.
 * Options are reversed so the answer isn't simply where the learner clicked before.
 */
export function ConceptCheck({ lesson }: { lesson: Lesson }) {
  const t = useT("lesson");
  const headingId = useId();
  const { revealSeen } = usePractice();
  const task = lesson.tasks.find((item) => item.module === "activate");
  const [choice, setChoice] = useState<string>();
  const [answered, setAnswered] = useState<number>();
  if (!task) return null;

  const order = task.options.map((_, index) => index).reverse();
  const answer = task.options[task.answerIndex];
  const right = answered === task.answerIndex;

  return (
    <section aria-labelledby={headingId} className="concept-check sbi-card">
      <h2 id={headingId}>{t("conceptCheckHeading")}</h2>
      <p>{t("conceptCheckIntro")}</p>
      {answered === undefined ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (choice === undefined) return;
            const picked = Number(choice);
            setAnswered(picked);
            track("concept_check_answered", {
              lessonId: lesson.lessonId,
              version: lesson.version,
              topic: topicOf(lesson.taxonomyId),
              itemId: task.taskId,
              instrument: CONCEPT_CHECK,
              phase: "post",
              correct: picked === task.answerIndex,
              explanationOpened: revealSeen,
            });
          }}
        >
          <RadioGroup
            legend={task.prompt}
            name={`check-${task.taskId}`}
            options={order.map((index) => ({
              value: String(index),
              label: task.options[index] ?? "",
            }))}
            value={choice}
            onChange={setChoice}
          />
          <Button type="submit" disabled={choice === undefined}>
            {t("conceptCheckSubmit")}
          </Button>
        </form>
      ) : null}
      <div role="status">
        {answered === undefined ? null : (
          <>
            <p>
              {right
                ? rich(t("conceptCheckRight"), { answer: <strong>{answer}</strong> })
                : rich(t("conceptCheckNotQuite"), { answer: <strong>{answer}</strong> })}
            </p>
            <p>{task.feedback[task.answerIndex]}</p>
          </>
        )}
      </div>
    </section>
  );
}
