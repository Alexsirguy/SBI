"use client";

import { SignInRequest } from "@sbi/contracts";
import { Button, TextField } from "@sbi/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { api } from "../../api";
import { AuthDivider } from "../auth-card";
import { fieldErrors } from "../form-errors";
import { GoogleButton } from "../google-button";
import { PasswordField } from "../password-field";
import { ACCOUNT_KEY, safeNext } from "../use-account";

export function SignInForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const client = useQueryClient();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  const done = useCallback(() => router.replace(next), [router, next]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFailure(undefined);
    const parsed = SignInRequest.safeParse(values);
    setErrors(parsed.success ? {} : fieldErrors(parsed.error));
    if (!parsed.success) return;
    setBusy(true);
    try {
      client.setQueryData(ACCOUNT_KEY, await api("signIn", parsed.data));
      done();
    } catch (error) {
      setFailure((error as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <GoogleButton mode="signin" onSignedIn={done} />
      <AuthDivider />
      <form className="auth__form" onSubmit={(event) => void submit(event)} noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={(event) => setValues({ ...values, email: event.target.value })}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          value={values.password}
          error={errors.password}
          aside={<Link href="/account/forgot">Forgot password?</Link>}
          onChange={(event) => setValues({ ...values, password: event.target.value })}
        />
        {failure ? (
          <p role="alert" className="auth__alert">
            {failure}
          </p>
        ) : null}
        <Button type="submit" block className="auth__submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </>
  );
}
