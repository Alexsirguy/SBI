"use client";

import { SignUpRequest } from "@sbi/contracts";
import { Button, TextField } from "@sbi/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { api } from "../../api";
import { AgeSelect, readAge } from "../age-select";
import { AuthDivider } from "../auth-card";
import { fieldErrors } from "../form-errors";
import { GoogleButton } from "../google-button";
import { PasswordField } from "../password-field";
import { ACCOUNT_KEY } from "../use-account";

const EMPTY = { age: "", email: "", firstName: "", lastName: "", password: "" };

export function SignUpForm() {
  const router = useRouter();
  const client = useQueryClient();
  const [values, setValues] = useState(EMPTY);
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
      setFailure(age.problem);
      return;
    }
    const parsed = SignUpRequest.safeParse({ ...values, age: "age" in age ? age.age : undefined });
    const found: Record<string, string> = parsed.success ? {} : fieldErrors(parsed.error);
    if ("problem" in age) found.age = age.problem;
    setErrors(found);
    if (!parsed.success) return;
    setBusy(true);
    try {
      client.setQueryData(ACCOUNT_KEY, await api("signUp", parsed.data));
      done();
    } catch (error) {
      setFailure((error as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <GoogleButton mode="signup" onSignedIn={done} />
      <AuthDivider />
      <form className="auth__form" onSubmit={(event) => void submit(event)} noValidate>
        <div className="auth__row">
          <TextField
            label="First name"
            autoComplete="given-name"
            value={values.firstName}
            error={errors.firstName}
            onChange={set("firstName")}
          />
          <TextField
            label="Last name"
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
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={set("email")}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          hint="At least 10 characters. A short phrase is easy to remember."
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
          {busy ? "Creating account…" : "Create Account"}
        </Button>
      </form>
      <p className="auth__fineprint">
        We keep your name, email and age to run your account, and nothing else.{" "}
        <Link href="/privacy">How we handle your data</Link>
      </p>
    </>
  );
}
