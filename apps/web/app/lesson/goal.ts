import type { ExperimentGoal } from "@sbi/contracts";
import { INTL_LOCALE, type Locale } from "../i18n/locales";
import type { LessonT } from "./lesson-t";

// Near goals without a tolerance count within 2%, about what a slider step can reach.
const nearTolerance = (goal: ExperimentGoal) => goal.tolerance ?? Math.abs(goal.value) * 0.02;

export function goalMet(goal: ExperimentGoal, value: number): boolean {
  switch (goal.op) {
    case "atLeast":
      return value >= goal.value;
    case "atMost":
      return value <= goal.value;
    case "near":
      return Math.abs(value - goal.value) <= nearTolerance(goal);
  }
}

/** Four significant figures by default: finer than the visual's three, as goals sit near them. */
export function formatReading(value: number, unit: string, locale: Locale, digits = 4): string {
  const number = value.toLocaleString(INTL_LOCALE[locale], { maximumSignificantDigits: digits });
  return unit ? `${number} ${unit}` : number;
}

/** A plain hint such as "Pitch is 160 Hz; you need at least 180 Hz." */
export function goalHint(
  goal: ExperimentGoal,
  value: number,
  readout: { label: string; unit: string },
  t: LessonT,
  locale: Locale,
): string {
  const target = formatReading(goal.value, readout.unit, locale);
  // A miss must never print as the goal itself, so add digits until the two differ.
  let digits = 4;
  while (digits < 10 && formatReading(value, readout.unit, locale, digits) === target) digits += 1;
  const values = {
    label: readout.label,
    value: formatReading(value, readout.unit, locale, digits),
    target,
  };
  return goal.op === "atLeast"
    ? t("goalAtLeast", values)
    : goal.op === "atMost"
      ? t("goalAtMost", values)
      : t("goalNear", {
          ...values,
          tolerance: formatReading(nearTolerance(goal), readout.unit, locale),
        });
}
