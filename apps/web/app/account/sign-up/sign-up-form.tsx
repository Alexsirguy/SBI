"use client";

import { SignUpRequest } from "@sbi/contracts";
import { Button, TextField } from "@sbi/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { api } from "../../api";
import { useT } from "../../i18n/provider";
import { AgeSelect, readAge } from "../age-select";
import { AuthDivider } from "../auth-card";
import { fieldErrors } from "../form-errors";
import { GoogleButton } from "../google-button";
import { PasswordField } from "../password-field";
import { RoleChoice, tooYoungToTeach, type Role } from "../role-choice";
import { ACCOUNT_KEY, forgetAccountData } from "../use-account";
import { useErrorText } from "../../i18n/error-text";

const EMPTY = { age: "", email: "", firstName: "", lastName: "", password: "" };

export function SignUpForm() {
  const errorText = useErrorText();
  const t = useT("account");
  const router = useRouter();
  const client = useQueryClient();
  const [values, setValues] = useState(EMPTY);
  const [role, setRole] = useState<Role>("learner");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  const done = useCallback(() => router.replace("/account"), [router]);
  const set = (field: keyof typeof EMPTY) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues({ ...values, [field]: event.target.value });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFailure(undefined);
    const age = readAge(values.age);
    // Under-13s are stopped here, before anything about them leaves the device.
    if ("underAge" in age && age.underAge) {
      setErrors({});
      setFailure(t(age.problem));
      return;
    }
    if ("age" in age && tooYoungToTeach(role, age.age)) {
      setErrors({});
      setFailure(t("errorUnderEducatorAge"));
      return;
    }
    const parsed = SignUpRequest.safeParse({
      ...values,
      age: "age" in age ? age.age : undefined,
      role,
    });
    const found: Record<string, string> = parsed.success
      ? {}
      : fieldErrors(parsed.error, {
          email: { invalid_format: t("errorEmail") },
          firstName: { too_small: t("errorName") },
          lastName: { too_small: t("errorName") },
          password: { too_big: t("errorPasswordLong"), too_small: t("errorPasswordShort") },
        });
    if ("problem" in age) found.age = t(age.problem);
    setErrors(found);
    if (!parsed.success) return;
    setBusy(true);
    try {
      const account = await api("signUp", parsed.data);
      forgetAccountData(client);
      client.setQueryData(ACCOUNT_KEY, account);
      done();
    } catch (error) {
      setFailure(errorText((error as Error).message));
      setBusy(false);
    }
  };

  return (
    <>
      <RoleChoice value={role} onChange={setRole} />
      <GoogleButton mode="signup" role={role} onSignedIn={done} />
      <AuthDivider />
      <form className="auth__form" onSubmit={(event) => void submit(event)} noValidate>
        <div className="auth__row">
          <TextField
            label={t("firstName")}
            autoComplete="given-name"
            value={values.firstName}
            error={errors.firstName}
            onChange={set("firstName")}
          />
          <TextField
            label={t("lastName")}
            autoComplete="family-name"
            value={values.lastName}
            error={errors.lastName}
            onChange={set("lastName")}
          />
        </div>
        <AgeSelect
          value={values.age}
          error={errors.age}
          onChange={(age) => setValues({ ...values, age })}
        />
        <TextField
          label={t("email")}
          type="email"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={set("email")}
        />
        <PasswordField
          label={t("password")}
          autoComplete="new-password"
          hint={t("signUpPasswordHint")}
          value={values.password}
          error={errors.password}
          onChange={set("password")}
        />
        {failure ? (
          <p role="alert" className="auth__alert">
            {failure}
          </p>
        ) : null}
        <Button type="submit" block className="auth__submit" disabled={busy}>
          {busy ? t("signUpBusy") : t("signUpButton")}
        </Button>
      </form>
      <p className="auth__fineprint">
        {t("signUpFineprint")} <Link href="/privacy">{t("signUpFineprintLink")}</Link>
      </p>
    </>
  );
}
