import type { ComponentProps, ReactNode } from "react";

const NOTICE_WORDS = { safety: "Safety", note: "Note", error: "Problem" } as const;

/** A notice always names its kind in words, and each kind has its own edge, never colour alone. */
export function Notice({
  kind,
  children,
  live = false,
}: {
  kind: keyof typeof NOTICE_WORDS;
  children: ReactNode;
  /** Announce when it appears; for errors that follow an action. */
  live?: boolean;
}) {
  return (
    <div className={`sbi-notice sbi-notice--${kind}`} role={live ? "alert" : undefined}>
      <strong className="sbi-notice__kind">{NOTICE_WORDS[kind]}</strong>
      <div className="sbi-notice__body">{children}</div>
    </div>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={["sbi-card", className].filter(Boolean).join(" ")} {...props} />;
}

/** Placeholder lines while content loads; hidden from assistive technology, which hears status. */
export function Placeholder({ lines = 3 }: { lines?: number }) {
  return (
    <div className="sbi-placeholder" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className="sbi-placeholder__line" />
      ))}
    </div>
  );
}

/** A native disclosure, so it works without script and with every screen reader. */
export function Disclosure({
  summary,
  children,
  open,
}: {
  summary: ReactNode;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="sbi-disclosure" open={open}>
      <summary className="sbi-disclosure__summary">{summary}</summary>
      <div className="sbi-disclosure__body">{children}</div>
    </details>
  );
}

/** One polite live region per screen for progress and outcomes. */
export function StatusLine({ className, ...props }: ComponentProps<"p">) {
  return (
    <p role="status" className={["sbi-status", className].filter(Boolean).join(" ")} {...props} />
  );
}

/** The highlighter: for the quick answer and quoted evidence only (ADR 0012). */
export function Mark({ children }: { children: ReactNode }) {
  return <mark className="sbi-mark">{children}</mark>;
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sbi-visually-hidden">{children}</span>;
}
