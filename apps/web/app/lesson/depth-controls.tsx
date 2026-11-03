"use client";

import { Disclosure, RadioGroup, SelectField } from "@sbi/ui";
import { useT } from "../i18n/provider";
import type { LessonKey } from "./lesson-t";
import { AGES, type AgeChoice, type Depth, DEPTHS, type LessonPrefs } from "./prefs";

const DEPTH_TEXT: Record<Depth, { label: LessonKey; hint: LessonKey }> = {
  quick: { label: "depthQuick", hint: "depthQuickHint" },
  explore: { label: "depthExplore", hint: "depthExploreHint" },
  deeper: { label: "depthDeeper", hint: "depthDeeperHint" },
};

const AGE_TEXT: Record<AgeChoice, LessonKey> = {
  none: "ageNone",
  child: "ageChild",
  teen: "ageTeen",
  adult: "ageAdult",
};

/** Depth and an optional age band, set only by the learner; changing either requests that version. */
export function DepthControls({
  prefs,
  onChange,
}: {
  prefs: LessonPrefs;
  onChange: (prefs: LessonPrefs) => void;
}) {
  const t = useT("lesson");
  return (
    <form
      className="depth-controls"
      aria-label={t("settingsForm")}
      onSubmit={(event) => event.preventDefault()}
    >
      <RadioGroup
        legend={t("explainIt")}
        name="depth"
        look="segmented"
        value={prefs.depth}
        onChange={(depth: Depth) => onChange({ ...prefs, depth })}
        options={(Object.keys(DEPTHS) as Depth[]).map((depth) => ({
          value: depth,
          label: t(DEPTH_TEXT[depth].label),
        }))}
      />
      {/* The pills have room for names only, so the chosen depth is explained here. */}
      <p className="sbi-field__hint">{t(DEPTH_TEXT[prefs.depth].hint)}</p>
      <Disclosure summary={t("ageBand")} open={prefs.age !== "none" || undefined}>
        <SelectField
          label={t("ageBandOptional")}
          value={prefs.age}
          onChange={(event) => onChange({ ...prefs, age: event.target.value as AgeChoice })}
        >
          {AGES.map((age) => (
            <option key={age} value={age}>
              {t(AGE_TEXT[age])}
            </option>
          ))}
        </SelectField>
      </Disclosure>
    </form>
  );
}
