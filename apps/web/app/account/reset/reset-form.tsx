"use client";

import { NewPassword } from "@sbi/contracts";
import { Button } from "@sbi/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "../../api";
import { useT } from "../../i18n/provider";
import { issueMessage } from "../form-errors";
import { PasswordField } from "../password-field";

export function ResetForm() {
  const t = useT("account");
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = NewPassword.safeParse(password);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(
        issue &&
          issueMessage(issue, {
            "": { too_big: t("errorPasswordLong"), too_small: t("errorPasswordShort") },
          }),
      );
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
        {t("resetDone")} <Link href="/account/sign-in">{t("resetSignInLink")}</Link>
      </p>
    );
  }
  return (
    <form className="auth__form" onSubmit={(event) => void submit(event)} noValidate>
      <PasswordField
        label={t("resetNewPassword")}
        autoComplete="new-password"
        hint={t("resetPasswordHint")}
        value={password}
        error={error}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Button type="submit" block className="auth__submit" disabled={busy}>
        {t("resetButton")}
      </Button>
    </form>
  );
}
