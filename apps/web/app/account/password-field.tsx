"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";

/** A password input with Show/Hide, so long phrases can be checked before sending. */
export function PasswordField({
  label,
  hint,
  error,
  aside,
  ...props
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  /** Sits on the label row, e.g. a "Forgot password?" link. */
  aside?: ReactNode;
} & Omit<ComponentProps<"input">, "type">) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean);
  return (
    <div className="sbi-field">
      <div className="auth__label-row">
        <label htmlFor={id} className="sbi-field__label">
          {label}
        </label>
        {aside}
      </div>
      <div className="auth__password">
        <input
          id={id}
          type={shown ? "text" : "password"}
          className="sbi-control"
          aria-describedby={describedBy.join(" ") || undefined}
          aria-invalid={error ? true : undefined}
          {...props}
        />
        <button
          type="button"
          className="auth__reveal"
          aria-pressed={shown}
          aria-controls={id}
          onClick={() => setShown((value) => !value)}
        >
          {shown ? "Hide" : "Show"}
          <span className="sbi-visually-hidden"> password</span>
        </button>
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="sbi-field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="sbi-field__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
