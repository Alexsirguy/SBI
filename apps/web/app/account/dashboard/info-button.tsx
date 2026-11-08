"use client";

import { Button } from "@sbi/ui";
import { useId, useRef, type ReactNode } from "react";
import { useT } from "../../i18n/provider";

/** Keeps a card to a line or two; the full explanation is one tap away in a modal. */
export function InfoButton({ topic, children }: { topic: string; children: ReactNode }) {
  const t = useT("account");
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  return (
    <>
      <button
        ref={opener}
        type="button"
        className="account-info__button"
        aria-haspopup="dialog"
        aria-label={t("infoMore", { topic })}
        onClick={() => dialog.current?.showModal()}
      >
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
          <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="10" cy="6.25" r="1.1" fill="currentColor" />
          <path d="M10 9v5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
      <dialog
        ref={dialog}
        className="account-info"
        aria-labelledby={headingId}
        // Focus goes back to the icon that opened it, so keyboard users are not lost.
        onClose={() => opener.current?.focus()}
      >
        <h2 id={headingId}>{topic}</h2>
        <div className="account-info__body">{children}</div>
        <Button variant="quiet" size="small" onClick={() => dialog.current?.close()}>
          {t("infoClose")}
        </Button>
      </dialog>
    </>
  );
}
