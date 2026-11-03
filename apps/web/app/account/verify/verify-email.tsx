"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { useT } from "../../i18n/provider";
import { useErrorText } from "../../i18n/error-text";

export function VerifyEmail() {
  const errorText = useErrorText();
  const t = useT("account");
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"checking" | "done" | string>("checking");
  // The link works once; a second effect run in development must not spend it twice.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    api("verifyEmail", { token }).then(
      () => setState("done"),
      (error: Error) => setState(error.message),
    );
  }, [token]);

  if (state === "checking") {
    return (
      <p role="status" className="auth__intro">
        {t("verifyChecking")}
      </p>
    );
  }
  if (state === "done") {
    return (
      <p role="status" className="auth__done">
        {t("verifyDone")} <Link href="/account">{t("verifyAccountLink")}</Link>.
      </p>
    );
  }
  return (
    <p role="alert" className="auth__alert">
      {errorText(state)} <Link href="/account">{t("verifyAccountLink")}</Link>{" "}
      {t("verifyFailedEnd")}
    </p>
  );
}
