"use client";

import { ForgotPasswordRequest } from "@sbi/contracts";
import { Button, TextField } from "@sbi/ui";
import { useState } from "react";
import { api } from "../../api";
import { useT } from "../../i18n/provider";
import { fieldErrors } from "../form-errors";
import { useErrorText } from "../../i18n/error-text";

export function ForgotForm() {
  const errorText = useErrorText();
  const t = useT("account");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = ForgotPasswordRequest.safeParse({ email });
    if (!parsed.success) {
      setError(fieldErrors(parsed.error, { email: { invalid_format: t("errorEmail") } }).email);
      return;
    }
    setBusy(true);
    try {
      await api("requestPasswordReset", parsed.data);
      setSent(true);
    } catch (failure) {
      setError(errorText((failure as Error).message));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <p role="status" className="auth__done">
        {t("forgotSent")}
      </p>
    );
  }
  return (
    <form className="auth__form" onSubmit={(event) => void submit(event)} noValidate>
      <TextField
        label={t("email")}
        type="email"
        autoComplete="email"
        value={email}
        error={error}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Button type="submit" block className="auth__submit" disabled={busy}>
        {t("forgotButton")}
      </Button>
    </form>
  );
}
