"use client";

import { Button, TextField } from "@sbi/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { webEnv } from "../../env";
import { api } from "../api";
import { useLocale, useT } from "../i18n/provider";
import { AgeSelect, readAge } from "./age-select";
import { ACCOUNT_KEY } from "./use-account";

interface GoogleIdentity {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: { credential: string }) => void;
        ux_mode: "popup";
        use_fedcm_for_prompt?: boolean;
      }): void;
      renderButton(
        parent: HTMLElement,
        options: {
          text: "signin_with" | "signup_with";
          width: number;
          theme: "outline" | "filled_black";
          size: "large";
          shape: "rectangular";
          logo_alignment: "center";
          locale: string;
        },
      ): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

const SCRIPT = "https://accounts.google.com/gsi/client";

// Follows the page's theme: an explicit choice on <html>, else the system setting.
function dark(): boolean {
  const chosen = document.documentElement.dataset.theme;
  if (chosen) return chosen === "dark";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

// One script tag for the whole app; the promise lets every button wait for it.
let loading: Promise<GoogleIdentity> | undefined;
function loadGoogle(): Promise<GoogleIdentity> {
  if (window.google) return Promise.resolve(window.google);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => (window.google ? resolve(window.google) : reject(new Error("no gsi")));
    script.onerror = () => {
      loading = undefined;
      reject(new Error("Google sign-in could not load."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Google's own button: its account picker opens in a popup, so the page never navigates away. */
export function GoogleButton({
  mode,
  onSignedIn,
}: {
  mode: "signin" | "signup";
  onSignedIn: () => void;
}) {
  const t = useT("account");
  const locale = useLocale();
  const target = useRef<HTMLDivElement>(null);
  const client = useQueryClient();
  const [error, setError] = useState<string>();
  const [details, setDetails] = useState<{
    credential: string;
    firstName: string;
    lastName: string;
  }>();
  const clientId = webEnv.googleClientId;

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadGoogle().then(
      (google) => {
        if (cancelled || !target.current) return;
        google.accounts.id.initialize({
          callback: ({ credential }) => {
            setError(undefined);
            api("googleSignIn", { credential }).then(
              async (result) => {
                if (result.status === "needs-details") {
                  setDetails({
                    credential,
                    firstName: result.firstName,
                    lastName: result.lastName,
                  });
                  return;
                }
                await client.invalidateQueries({ queryKey: ACCOUNT_KEY });
                onSignedIn();
              },
              (failure: Error) => setError(failure.message),
            );
          },
          client_id: clientId,
          ux_mode: "popup",
        });
        // Google draws the button at a fixed width, so it is sized to fill the card once.
        google.accounts.id.renderButton(target.current, {
          locale,
          logo_alignment: "center",
          shape: "rectangular",
          size: "large",
          text: mode === "signup" ? "signup_with" : "signin_with",
          theme: dark() ? "filled_black" : "outline",
          width: Math.min(400, Math.max(200, target.current.clientWidth)),
        });
      },
      () => !cancelled && setError(t("googleLoadFailed")),
    );
    return () => {
      cancelled = true;
    };
  }, [client, clientId, locale, mode, onSignedIn, t]);

  if (!clientId) return null;
  if (details) {
    return (
      <GoogleDetails
        {...details}
        onDone={async () => {
          await client.invalidateQueries({ queryKey: ACCOUNT_KEY });
          onSignedIn();
        }}
      />
    );
  }
  return (
    <div className="auth__google">
      <div ref={target} />
      {error ? (
        <p role="alert" className="auth__alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A new Google user still gives their age, so the 13+ rule applies to them too. */
function GoogleDetails({
  credential,
  firstName,
  lastName,
  onDone,
}: {
  credential: string;
  firstName: string;
  lastName: string;
  onDone: () => Promise<void>;
}) {
  const t = useT("account");
  const [values, setValues] = useState({ age: "", firstName, lastName });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!values.firstName.trim() || !values.lastName.trim()) {
      setError(t("googleNameMissing"));
      return;
    }
    const age = readAge(values.age);
    if ("problem" in age) {
      setError(t(age.problem));
      return;
    }
    setBusy(true);
    try {
      await api("finishGoogleSignUp", { ...values, age: age.age, credential });
      await onDone();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="auth__form" onSubmit={(event) => void submit(event)} noValidate>
      <h2 className="auth__step">{t("googleStepTitle")}</h2>
      <p className="auth__intro">{t("googleStepIntro")}</p>
      <div className="auth__row">
        <TextField
          label={t("firstName")}
          autoComplete="given-name"
          value={values.firstName}
          onChange={(event) => setValues({ ...values, firstName: event.target.value })}
        />
        <TextField
          label={t("lastName")}
          autoComplete="family-name"
          value={values.lastName}
          onChange={(event) => setValues({ ...values, lastName: event.target.value })}
        />
      </div>
      <AgeSelect value={values.age} onChange={(age) => setValues({ ...values, age })} />
      {error ? (
        <p role="alert" className="auth__alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" block className="auth__submit" disabled={busy}>
        {t("googleFinish")}
      </Button>
    </form>
  );
}
