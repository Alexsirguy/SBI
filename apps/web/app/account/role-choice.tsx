"use client";

import { EDUCATOR_MIN_AGE, type AccountRole } from "@sbi/contracts";
import type { z } from "zod";
import { useT } from "../i18n/provider";

export type Role = z.infer<typeof AccountRole>;

/** "I teach or tutor" asks for teaching tools up front instead of a later trip to /teach. */
export function RoleChoice({ value, onChange }: { value: Role; onChange: (role: Role) => void }) {
  const t = useT("account");
  const option = (role: Role, label: string, hint: string) => (
    <label className="auth-role__option">
      <input
        type="radio"
        name="role"
        value={role}
        checked={value === role}
        onChange={() => onChange(role)}
      />
      <span className="auth-role__label">{label}</span>
      <span className="auth-role__hint">{hint}</span>
    </label>
  );
  return (
    <fieldset className="auth-role">
      <legend className="auth-role__legend">{t("roleLegend")}</legend>
      <div className="auth-role__options">
        {option("learner", t("roleLearner"), t("roleLearnerHint"))}
        {option("educator", t("roleEducator"), t("roleEducatorHint"))}
      </div>
    </fieldset>
  );
}

/** Teaching tools are adults-only; checked here so the refusal comes before anything is sent. */
export function tooYoungToTeach(role: Role, age: number): boolean {
  return role === "educator" && age < EDUCATOR_MIN_AGE;
}
