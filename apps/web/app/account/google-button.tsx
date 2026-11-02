"use client";

import { MIN_ACCOUNT_AGE, UNDER_MIN_AGE } from "@sbi/contracts";
import { Button, TextField } from "@sbi/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { webEnv } from "../../env";
import { api } from "../api";
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
        options: { text: "signin_with" | "signup_with"; width?: number; shape?: "pill" },
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
        google.accounts.id.renderButton(target.current, {
          shape: "pill",
          text: mode === "signup" ? "signup_with" : "signin_with",
          width: 280,
        });
      },
      (failure: Error) => !cancelled && setError(failure.message),
    );
    return () => {
      cancelled = true;
    };
  }, [client, clientId, mode, onSignedIn]);

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
    <div className="account-google">
      <div ref={target} />
      {error ? <p role="alert">{error}</p> : null}
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
  const [values, setValues] = useState({ age: "", firstName, lastName });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const age = Number(values.age);
    if (!values.firstName.trim() || !values.lastName.trim() || !values.age) {
      setError("Fill in your name and age.");
      return;
    }
    if (age < MIN_ACCOUNT_AGE) {
      setError(UNDER_MIN_AGE);
      return;
    }
    setBusy(true);
    try {
      await api("finishGoogleSignUp", { ...values, age, credential });
      await onDone();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="account-form" onSubmit={(event) => void submit(event)} noValidate>
      <h2>One more step</h2>
      <p>Check your name and tell us your age to finish making your account.</p>
      <TextField
        label="First name"
        autoComplete="given-name"
        value={values.firstName}
        onChange={(event) => setValues({ ...values, firstName: event.target.value })}
      />
      <TextField
        label="Last name"
        autoComplete="family-name"
        value={values.lastName}
        onChange={(event) => setValues({ ...values, lastName: event.target.value })}
      />
      <TextField
        label="Age"
        inputMode="numeric"
        hint="Accounts are for people 13 and over."
        value={values.age}
        onChange={(event) => setValues({ ...values, age: event.target.value.replace(/\D/g, "") })}
      />
      {error ? <p role="alert">{error}</p> : null}
      <Button type="submit" disabled={busy}>
        Finish
      </Button>
    </form>
  );
}
