"use client";

import { NewPassword } from "@sbi/contracts";
import { Button, TextField } from "@sbi/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "../../api";

export function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = NewPassword.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setBusy(true);
    try {
      await api("resetPassword", { password, token });
      setDone(true);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p role="status">
        Your password is changed, and every device was signed out.{" "}
        <Link href="/account/sign-in">Sign in</Link>
      </p>
    );
  }
  return (
    <form className="account-form" onSubmit={(event) => void submit(event)} noValidate>
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters."
        value={password}
        error={error}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Button type="submit" disabled={busy}>
        Change password
      </Button>
    </form>
  );
}
