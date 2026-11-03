"use client";

import { NewPassword } from "@sbi/contracts";
import { Button } from "@sbi/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "../../api";
import { PasswordField } from "../password-field";

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
      <p role="status" className="auth__done">
        Your password is changed, and every device was signed out.{" "}
        <Link href="/account/sign-in">Sign in</Link>
      </p>
    );
  }
  return (
    <form className="auth__form" onSubmit={(event) => void submit(event)} noValidate>
      <PasswordField
        label="New password"
        autoComplete="new-password"
        hint="At least 10 characters."
        value={password}
        error={error}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Button type="submit" block className="auth__submit" disabled={busy}>
        Change password
      </Button>
    </form>
  );
}
