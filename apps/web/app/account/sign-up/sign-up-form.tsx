"use client";

import { MIN_ACCOUNT_AGE, SignUpRequest, UNDER_MIN_AGE } from "@sbi/contracts";
import { Button, TextField } from "@sbi/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { api } from "../../api";
import { fieldErrors } from "../form-errors";
import { GoogleButton } from "../google-button";
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
    const parsed = SignUpRequest.safeParse(values);
    const found = parsed.success ? {} : fieldErrors(parsed.error);
    // Under-13s are stopped here, before anything about them leaves the device.
    if (parsed.success && parsed.data.age < MIN_ACCOUNT_AGE) {
      setErrors({});
      setFailure(UNDER_MIN_AGE);
      return;
    }
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
      <form className="account-form" onSubmit={(event) => void submit(event)} noValidate>
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
        <TextField
          label="Age"
          inputMode="numeric"
          hint="Accounts are for people 13 and over."
          value={values.age}
          error={errors.age}
          onChange={(event) => setValues({ ...values, age: event.target.value.replace(/\D/g, "") })}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={set("email")}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 10 characters. A short phrase is easy to remember and hard to guess."
          value={values.password}
          error={errors.password}
          onChange={set("password")}
        />
        {failure ? <p role="alert">{failure}</p> : null}
        <Button type="submit" disabled={busy}>
          Make my account
        </Button>
      </form>
      <p>
        Already have an account? <Link href="/account/sign-in">Sign in</Link>
      </p>
    </>
  );
}
