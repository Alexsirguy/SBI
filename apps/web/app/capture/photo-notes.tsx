"use client";

import { useId, useState } from "react";
import { useT } from "../i18n/provider";

/** How a photo is handled: always open on wide screens, folded behind a toggle on phones. */
export function PhotoNotes({ heading, items }: { heading: string; items: string[] }) {
  const t = useT("capture");
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className={`privacy-cue${open ? " privacy-cue--open" : ""}`}
    >
      <div className="privacy-cue__head">
        <h2 id={`${id}-heading`}>{heading}</h2>
        <button
          type="button"
          className="privacy-cue__toggle"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          onClick={() => setOpen(!open)}
        >
          {open ? t("privacyHide") : t("privacyShow")}
        </button>
      </div>
      <ul id={`${id}-list`}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
