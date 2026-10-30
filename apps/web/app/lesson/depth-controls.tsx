"use client";

import { useId } from "react";
import { AGES, type AgeChoice, type Depth, DEPTHS, type LessonPrefs } from "./prefs";

/** Depth and an optional age band, set only by the learner; changing either requests that version. */
export function DepthControls({
  prefs,
  onChange,
}: {
  prefs: LessonPrefs;
  onChange: (prefs: LessonPrefs) => void;
}) {
  const ageId = useId();
  return (
    <form
      className="depth-controls"
      aria-label="Lesson settings"
      onSubmit={(event) => event.preventDefault()}
    >
      <fieldset>
        <legend>How deep?</legend>
        {(Object.keys(DEPTHS) as Depth[]).map((depth) => (
          <label key={depth}>
            <input
              type="radio"
              name="depth"
              value={depth}
              checked={prefs.depth === depth}
              onChange={() => onChange({ ...prefs, depth })}
            />
            {DEPTHS[depth].label} <span className="hint">({DEPTHS[depth].hint})</span>
          </label>
        ))}
      </fieldset>
      <label htmlFor={ageId}>Age band (optional)</label>
      <select
        id={ageId}
        value={prefs.age}
        onChange={(event) => onChange({ ...prefs, age: event.target.value as AgeChoice })}
      >
        {(Object.keys(AGES) as AgeChoice[]).map((age) => (
          <option key={age} value={age}>
            {AGES[age]}
          </option>
        ))}
      </select>
    </form>
  );
}
