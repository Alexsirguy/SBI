"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { accountSession } from "../account-session";

export function FinishSignIn() {
  const router = useRouter();
  const [failed, setFailed] = useState(!accountSession);
  // The provider's code can be redeemed once; a second effect run would fail it.
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !accountSession) return;
    started.current = true;
    accountSession.finishSignIn().then(
      (returnTo) => router.replace(returnTo),
      () => setFailed(true),
    );
  }, [router]);

  return failed ? (
    <p role="alert">
      Sign-in did not finish. <Link href="/account">Try again</Link>.
    </p>
  ) : (
    <p role="status">Finishing sign-in…</p>
  );
}
