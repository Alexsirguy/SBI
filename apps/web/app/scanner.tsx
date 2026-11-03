"use client";

import { useT } from "./i18n/provider";

/** The prototype's "looking closely" loader: the learner's own photo under a sweeping scanline. */
export function Scanner({ src, label }: { src?: string | null; label?: string }) {
  const t = useT("capture");
  return (
    <div className="scanner">
      {src ? (
        // A local object URL of the learner's photo, which next/image cannot optimise.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={t("yourPhoto")} />
      ) : (
        <span className="scanner__label">{label}</span>
      )}
      <span className="scanner__line" aria-hidden="true" />
    </div>
  );
}
