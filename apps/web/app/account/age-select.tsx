"use client";

import { MIN_ACCOUNT_AGE, UNDER_MIN_AGE } from "@sbi/contracts";
import { SelectField } from "@sbi/ui";

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
  return (
    <div className="auth__age">
      <SelectField
        label="Age"
        hint="Accounts are for people 13 and over."
        required
        value={value}
        error={error}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" disabled>
          Choose
        </option>
        <option value={UNDER_13}>Under 13</option>
        {AGES.map((age) => (
          <option key={age} value={age}>
            {age}
          </option>
        ))}
        <option value="100">100 or over</option>
      </SelectField>
    </div>
  );
}

/** The age to send, or why not: nothing is sent for an under-13 or a missing choice. */
export function readAge(value: string): { age: number } | { problem: string; underAge: boolean } {
  if (value === UNDER_13) return { problem: UNDER_MIN_AGE, underAge: true };
  if (!value) return { problem: "Choose your age.", underAge: false };
  return { age: Number(value) };
}
