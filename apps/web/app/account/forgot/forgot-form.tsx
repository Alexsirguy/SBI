"use client";

import { ForgotPasswordRequest } from "@sbi/contracts";
import { Button, TextField } from "@sbi/ui";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../api";
import { fieldErrors } from "../form-errors";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = ForgotPasswordRequest.safeParse({ email });
    if (!parsed.success) {
      setError(fieldErrors(parsed.error).email);
      return;
    }
    setBusy(true);
    try {
      await api("requestPasswordReset", parsed.data);
      setSent(true);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <p role="status">
        If that email has an account, we have sent it a link to choose a new password. The link
        works for 1 hour. <Link href="/account/sign-in">Back to sign in</Link>
      </p>
    );
  }
  return (
    <form className="account-form" onSubmit={(event) => void submit(event)} noValidate>
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        error={error}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Button type="submit" disabled={busy}>
        Send me a link
      </Button>
    </form>
  );
}
