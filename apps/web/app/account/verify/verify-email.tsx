"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "../../api";

export function VerifyEmail() {
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

  if (state === "checking") return <p role="status">Confirming your email…</p>;
  if (state === "done") {
    return (
      <p role="status">
        Your email is confirmed. <Link href="/account">Go to your account</Link>.
      </p>
    );
  }
  return (
    <p role="alert">
      {state} <Link href="/account">Go to your account</Link> to send a new link.
    </p>
  );
}
