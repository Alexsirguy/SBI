"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef, useSyncExternalStore, type KeyboardEvent } from "react";
import { useAccount } from "./account/use-account";
import { PHOTO_RETENTION_DAYS } from "./capture/limits";
import { ConsentRequests, useUnanswered } from "./consent-requests";
import { useT } from "./i18n/provider";

const KEY = "sbi.privacy-corner";
const listeners = new Set<() => void>();

// A remembered layout preference, never a consent: hiding the notes agrees to nothing.
function readOpen(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "collapsed";
  } catch {
    return true;
  }
}

function writeOpen(open: boolean) {
  try {
    window.localStorage.setItem(KEY, open ? "open" : "collapsed");
  } catch {
    // Storage refused: the notes simply open again on the next page.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Consent requests and privacy notes docked to the right edge; open on a first visit, then as
 * the learner left them. */
export function PrivacyCorner() {
  const t = useT("site");
  const pathname = usePathname();
  const panelId = useId();
  const headingId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  // Storage exists only in the browser, so the server renders nothing here.
  const open = useSyncExternalStore(subscribe, readOpen, () => null);
  const unanswered = useUnanswered();

  // The privacy page already says all of this at length.
  if (open === null || pathname === "/privacy") return null;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !open) return;
    writeOpen(false);
    toggleRef.current?.focus();
  };

  return (
    <aside className="privacy-corner" data-open={open} aria-label={t("privacyCornerLabel")}>
      {open ? (
        <div
          id={panelId}
          className="privacy-corner__panel"
          role="region"
          aria-labelledby={headingId}
          onKeyDown={onKeyDown}
        >
          <h2 id={headingId} className="privacy-corner__heading">
            {t("privacyCornerHeading")}
          </h2>
          <ConsentRequests />
          <PrivacyNotes />
          <Link href="/privacy#choices" className="privacy-corner__link">
            {t("privacyCornerChoices")}
          </Link>
        </div>
      ) : null}
      <button
        ref={toggleRef}
        type="button"
        className="privacy-corner__tab"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => writeOpen(!open)}
        onKeyDown={onKeyDown}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <rect
            x="3.5"
            y="8.5"
            width="13"
            height="9"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M6.5 8.5 V6 a3.5 3.5 0 0 1 7 0 V8.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <circle cx="10" cy="13" r="1.4" fill="currentColor" />
        </svg>
        <span>{open ? t("privacyCornerHide") : t("privacyCornerOpen")}</span>
        {/* The space keeps "Privacy" and the count apart when read aloud. */}
        {!open && unanswered ? " " : null}
        {!open && unanswered ? (
          <span className="privacy-corner__count">
            {t("privacyCornerToAnswer", { count: unanswered })}
          </span>
        ) : null}
        <svg
          className="privacy-corner__chevron"
          width="14"
          height="14"
          viewBox="0 0 14 14"
          aria-hidden="true"
        >
          <path
            d="M3 9 L7 5 L11 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </aside>
  );
}

// Asked for only while the notes are open, so a hidden tab never calls the API.
function PrivacyNotes() {
  const t = useT("site");
  const account = useAccount();
  const signedIn = Boolean(account.data);
  return (
    <dl className="privacy-corner__notes">
      <div>
        <dt>{t("privacyCornerPhotosTerm")}</dt>
        <dd>{t("privacyCornerPhotos", { days: PHOTO_RETENTION_DAYS })}</dd>
      </div>
      <div>
        <dt>{t("privacyCornerTrackingTerm")}</dt>
        <dd>{t("privacyCornerTracking")}</dd>
      </div>
      <div>
        <dt>{t("privacyCornerCookiesTerm")}</dt>
        <dd>{signedIn ? t("privacyCornerSignedIn") : t("privacyCornerSignedOut")}</dd>
      </div>
    </dl>
  );
}
