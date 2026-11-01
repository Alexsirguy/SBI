"use client";

import type { Experiment, LessonSection, LessonTask } from "@sbi/contracts";
import { Button, RadioGroup } from "@sbi/ui";
import { useState } from "react";
import type { ExperimentController } from "../experiment";
import { formatReading, goalHint, goalMet } from "../goal";
import { useExperiment, useReadout } from "../practice";
import { SectionFrame } from "./frame";

interface Readout {
  label: string;
  unit: string;
}

/** Without a usable experiment the options are the task: pick one, read why, try again. */
function ChoiceChallenge({
  task,
  settingUp,
  onPick,
}: {
  task: LessonTask;
  settingUp: boolean;
  onPick: () => void;
}) {
  const [picked, setPicked] = useState<number>();
  const solved = picked === task.answerIndex;
  return (
    <>
      {settingUp ? <p className="challenge__note">Setting up the experiment…</p> : null}
      <p className="challenge__prompt">{task.prompt}</p>
      <ul className="challenge__options" aria-label="Choose an answer">
        {task.options.map((option, index) => (
          <li key={option}>
            <Button
              variant="quiet"
              aria-pressed={picked === index}
              disabled={solved && index !== picked}
              onClick={() => {
                setPicked(index);
                onPick();
              }}
            >
              {option}
            </Button>
          </li>
        ))}
      </ul>
      <div role="status" className="challenge__result">
        {picked === undefined ? null : (
          <>
            <p className="challenge__verdict">{solved ? "Solved." : "Not quite. Try another."}</p>
            <p>{task.feedback[picked]}</p>
          </>
        )}
      </div>
    </>
  );
}

interface Checked {
  met: boolean;
  hint?: string;
}

function ExperimentChallenge({
  task,
  goal,
  controller,
  readout,
}: {
  task: LessonTask;
  goal: NonNullable<LessonTask["goal"]>;
  controller: ExperimentController;
  readout: Readout;
}) {
  const [prediction, setPrediction] = useState<string>();
  const [setUp, setSetUp] = useState(false);
  const [checked, setChecked] = useState<Checked>();
  const [loading, setLoading] = useState(false);
  const value = useReadout(controller, goal.readoutId);
  const predicted = prediction === undefined ? undefined : Number(prediction);
  return (
    <>
      <RadioGroup
        legend={`${task.prompt} First, predict:`}
        name={`predict-${task.taskId}`}
        options={task.options.map((option, index) => ({ value: String(index), label: option }))}
        value={prediction}
        onChange={setPrediction}
      />
      {predicted !== undefined ? (
        <div className="challenge__actions">
          <Button
            variant={setUp ? "quiet" : "primary"}
            onClick={() => {
              const applied = controller.apply(task.setup);
              controller.reveal();
              setLoading(!applied);
              setSetUp(applied);
              setChecked(undefined);
            }}
          >
            {setUp ? "Start again" : "Set up the experiment"}
          </Button>
          {setUp ? (
            <>
              <p className="challenge__reading">
                {readout.label} now:{" "}
                <span className="challenge__value">
                  {value === undefined ? "—" : formatReading(value, readout.unit)}
                </span>
              </p>
              <Button
                onClick={() => {
                  if (value === undefined) return;
                  const met = goalMet(goal, value);
                  setChecked({ met, hint: met ? undefined : goalHint(goal, value, readout) });
                }}
              >
                Check
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
      <div role="status" className="challenge__result">
        {loading ? <p>The experiment is still loading. Try again in a moment.</p> : null}
        {setUp && !checked ? (
          <p>Move the sliders in the experiment above, then press Check.</p>
        ) : null}
        {checked?.met ? (
          <>
            <p className="challenge__verdict">Solved.</p>
            <p>{task.feedback[task.answerIndex]}</p>
          </>
        ) : null}
        {checked && !checked.met ? (
          <>
            <p className="challenge__verdict">Not yet.</p>
            {predicted !== undefined && predicted !== task.answerIndex ? (
              <p>{task.feedback[predicted]}</p>
            ) : null}
            <p>{checked.hint} Adjust the experiment and check again.</p>
          </>
        ) : null}
      </div>
    </>
  );
}

function ChallengeCard({
  task,
  number,
  readouts,
}: {
  task: LessonTask;
  number: number;
  readouts: Experiment["readouts"];
}) {
  const { goal } = task;
  const { controller, pending } = useExperiment({
    controls: task.setup.map((setting) => setting.controlId),
    readouts: goal ? [goal.readoutId] : [],
  });
  // Once a learner has answered by choice, the card stays a choice when the experiment arrives.
  const [mode, setMode] = useState<"experiment" | "choice">();
  const readout = readouts.find((item) => item.id === goal?.readoutId);
  const live = mode !== "choice" && goal && controller && readout ? controller : undefined;
  const headingId = `challenge-${task.taskId}`;
  return (
    <article className="challenge sbi-card" aria-labelledby={headingId}>
      <h3 id={headingId}>Challenge {number}</h3>
      {live && goal && readout ? (
        <ExperimentChallenge task={task} goal={goal} controller={live} readout={readout} />
      ) : (
        <ChoiceChallenge
          task={task}
          settingUp={Boolean(goal) && pending}
          onPick={() => setMode("choice")}
        />
      )}
    </article>
  );
}

/** Merrill's application: the learner solves new challenges, with coaching instead of a score. */
export function ApplySection({
  section,
  tasks,
  experiment,
}: {
  section: LessonSection;
  tasks: LessonTask[];
  experiment?: Experiment;
}) {
  const readouts = experiment?.readouts ?? [];
  return (
    <SectionFrame section={section}>
      <p>{section.text}</p>
      <div className="challenges">
        {tasks.map((task, index) => (
          <ChallengeCard key={task.taskId} task={task} number={index + 1} readouts={readouts} />
        ))}
      </div>
    </SectionFrame>
  );
}
