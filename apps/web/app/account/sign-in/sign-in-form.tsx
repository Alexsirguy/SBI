"use client";

import { SignInRequest } from "@sbi/contracts";
import { Button, TextField } from "@sbi/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { api } from "../../api";
import { fieldErrors } from "../form-errors";
import { GoogleButton } from "../google-button";
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
      <form className="account-form" onSubmit={(event) => void submit(event)} noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={(event) => setValues({ ...values, email: event.target.value })}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          error={errors.password}
          onChange={(event) => setValues({ ...values, password: event.target.value })}
        />
        {failure ? <p role="alert">{failure}</p> : null}
        <Button type="submit" disabled={busy}>
          Sign in
        </Button>
      </form>
      <p>
        <Link href="/account/forgot">Forgot your password?</Link>
      </p>
      <p>
        New here? <Link href="/account/sign-up">Make an account</Link>
      </p>
    </>
  );
}
