"use client";

import { type ComponentProps, type ReactNode, useId } from "react";

interface FieldParts {
  label: ReactNode;
  hint?: ReactNode;
  /** Shown as an alert and tied to the control, which is marked invalid. */
  error?: ReactNode;
}

// One place wires label, hint and error to the control, so no field ships without them.
function useFieldIds(id: string | undefined, hint: unknown, error: unknown) {
  const generated = useId();
  const controlId = id ?? generated;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const describedBy = [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ");
  return { controlId, hintId, errorId, describedBy: describedBy || undefined };
}

function FieldFrame({
  parts,
  ids,
  children,
}: {
  parts: FieldParts;
  ids: ReturnType<typeof useFieldIds>;
  children: ReactNode;
}) {
  return (
    <div className="sbi-field">
      <label htmlFor={ids.controlId} className="sbi-field__label">
        {parts.label}
      </label>
      {children}
      {parts.hint ? (
        <p id={ids.hintId} className="sbi-field__hint">
          {parts.hint}
        </p>
      ) : null}
      {parts.error ? (
        <p id={ids.errorId} role="alert" className="sbi-field__error">
          {parts.error}
        </p>
      ) : null}
    </div>
  );
}

export type TextFieldProps = FieldParts & Omit<ComponentProps<"input">, "children">;

export function TextField({ label, hint, error, id, className, ...props }: TextFieldProps) {
  const ids = useFieldIds(id, hint, error);
  return (
    <FieldFrame parts={{ label, hint, error }} ids={ids}>
      <input
        id={ids.controlId}
        className={["sbi-control", className].filter(Boolean).join(" ")}
        aria-describedby={ids.describedBy}
        aria-invalid={error ? true : undefined}
        {...props}
      />
    </FieldFrame>
  );
}

export type TextAreaProps = FieldParts & ComponentProps<"textarea">;

export function TextArea({ label, hint, error, id, className, ...props }: TextAreaProps) {
  const ids = useFieldIds(id, hint, error);
  return (
    <FieldFrame parts={{ label, hint, error }} ids={ids}>
      <textarea
        id={ids.controlId}
        className={["sbi-control", className].filter(Boolean).join(" ")}
        aria-describedby={ids.describedBy}
        aria-invalid={error ? true : undefined}
        {...props}
      />
    </FieldFrame>
  );
}

export type SelectFieldProps = FieldParts & ComponentProps<"select">;

export function SelectField({
  label,
  hint,
  error,
  id,
  className,
  children,
  ...props
}: SelectFieldProps) {
  const ids = useFieldIds(id, hint, error);
  return (
    <FieldFrame parts={{ label, hint, error }} ids={ids}>
      <select
        id={ids.controlId}
        className={["sbi-control", className].filter(Boolean).join(" ")}
        aria-describedby={ids.describedBy}
        aria-invalid={error ? true : undefined}
        {...props}
      >
        {children}
      </select>
    </FieldFrame>
  );
}
