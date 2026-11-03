"use client";

import { MIN_ACCOUNT_AGE } from "@sbi/contracts";
import { SelectField } from "@sbi/ui";
import { useT } from "../i18n/provider";

export const UNDER_13 = "under-13";
const AGES = Array.from({ length: 100 - MIN_ACCOUNT_AGE }, (_, index) => MIN_ACCOUNT_AGE + index);

/** "Under 13" is offered so a child is told why, rather than guessing a number to get in. */
export function AgeSelect({
  value,
  error,
  onChange,
}: {
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const t = useT("account");
  return (
    <div className="auth__age">
      <SelectField
        label={t("ageLabel")}
        hint={t("ageHint")}
        required
        value={value}
        error={error}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" disabled>
          {t("ageChoose")}
        </option>
        <option value={UNDER_13}>{t("ageUnder13")}</option>
        {AGES.map((age) => (
          <option key={age} value={age}>
            {age}
          </option>
        ))}
        <option value="100">{t("age100OrOver")}</option>
      </SelectField>
    </div>
  );
}

/** The age to send, or why not: nothing is sent for an under-13 or a missing choice. */
export function readAge(
  value: string,
): { age: number } | { problem: "errorUnderMinAge" | "errorChooseAge"; underAge: boolean } {
  if (value === UNDER_13) return { problem: "errorUnderMinAge", underAge: true };
  if (!value) return { problem: "errorChooseAge", underAge: false };
  return { age: Number(value) };
}
