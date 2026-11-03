import Link from "next/link";
import type { ReactNode } from "react";
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
  return (
    <main id="main" className="auth">
      <div className="auth__card">
        {tab ? (
          <nav aria-label="Account" className="auth__switch">
            <Link href="/account/sign-in" aria-current={tab === "sign-in" ? "page" : undefined}>
              Sign in
            </Link>
            <Link href="/account/sign-up" aria-current={tab === "sign-up" ? "page" : undefined}>
              Create account
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
  return (
    <p className="auth__divider">
      <span>or use your email</span>
    </p>
  );
}
