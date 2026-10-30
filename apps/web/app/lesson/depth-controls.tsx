"use client";

import { RadioGroup, SelectField } from "@sbi/ui";
import { AGES, type AgeChoice, type Depth, DEPTHS, type LessonPrefs } from "./prefs";

/** Depth and an optional age band, set only by the learner; changing either requests that version. */
export function DepthControls({
  prefs,
  onChange,
}: {
  prefs: LessonPrefs;
  onChange: (prefs: LessonPrefs) => void;
}) {
  return (
    <form
      className="depth-controls"
      aria-label="Lesson settings"
      onSubmit={(event) => event.preventDefault()}
    >
      <RadioGroup
        legend="How deep?"
        name="depth"
        look="segmented"
        value={prefs.depth}
        onChange={(depth: Depth) => onChange({ ...prefs, depth })}
        options={(Object.keys(DEPTHS) as Depth[]).map((depth) => ({
          value: depth,
          label: DEPTHS[depth].label,
        }))}
      />
      {/* The segmented control has room for names only, so the chosen depth is explained here. */}
      <p className="sbi-field__hint">{DEPTHS[prefs.depth].hint}</p>
      <SelectField
        label="Age band (optional)"
        value={prefs.age}
        onChange={(event) => onChange({ ...prefs, age: event.target.value as AgeChoice })}
      >
        {(Object.keys(AGES) as AgeChoice[]).map((age) => (
          <option key={age} value={age}>
            {AGES[age]}
          </option>
        ))}
      </SelectField>
    </form>
  );
}
