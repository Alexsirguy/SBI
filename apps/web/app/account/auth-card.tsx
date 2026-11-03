"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useT } from "../i18n/provider";
import "./account.css";

/** The one paper card every sign-in step sits on; the switch appears only where both apply. */
export function AuthCard({
  title,
  intro,
  tab,
  children,
  footer,
}: {
  title: string;
  intro?: ReactNode;
  tab?: "sign-in" | "sign-up";
  children: ReactNode;
  footer?: ReactNode;
}) {
  const t = useT("account");
  return (
    <main id="main" className="auth">
      <div className="auth__card">
        {tab ? (
          <nav aria-label={t("navLabel")} className="auth__switch">
            <Link href="/account/sign-in" aria-current={tab === "sign-in" ? "page" : undefined}>
              {t("tabSignIn")}
            </Link>
            <Link href="/account/sign-up" aria-current={tab === "sign-up" ? "page" : undefined}>
              {t("tabCreateAccount")}
            </Link>
          </nav>
        ) : null}
        <h1 className="auth__title">{title}</h1>
        {intro ? <p className="auth__intro">{intro}</p> : null}
        {children}
      </div>
      {footer ? <div className="auth__footer">{footer}</div> : null}
    </main>
  );
}

/** Separates the Google button from the email form; says what the second way is. */
export function AuthDivider() {
  const t = useT("account");
  return (
    <p className="auth__divider">
      <span>{t("orUseEmail")}</span>
    </p>
  );
}
