"use client";

import { CONSENT_VERSION } from "@sbi/contracts";
import { Button } from "@sbi/ui";
import Link from "next/link";
import { useState } from "react";
import { rememberKeptPhoto, setConsent } from "../consent";
import { useT } from "../i18n/provider";
import { GrownUpGate } from "../pathway/grown-up-gate";
import { usePathway } from "../pathway/provider";
import { useKeepPhoto } from "./use-photo-upload";
import { useErrorText } from "../i18n/error-text";

/** The save-photos opt-in, asked at the moment it matters and never ticked in advance (spec §12). */
export function KeepPhoto({ photoKey, label }: { photoKey: string; label: string }) {
  const errorText = useErrorText();
  const t = useT("capture");
  const [asking, setAsking] = useState(false);
  const { pathway } = usePathway();
  const tp = useT("pathway");
  const [gating, setGating] = useState(false);

  const keepNow = () => {
    setConsent("save-photos", true);
    keep.mutate(
      { key: photoKey, consentVersion: CONSENT_VERSION },
      {
        onSuccess: () =>
          rememberKeptPhoto({ key: photoKey, label, keptAt: new Date().toISOString() }),
      },
    );
  };
  const keep = useKeepPhoto();

  if (keep.isSuccess) {
    return (
      <p role="status" className="keep-photo">
        {t("keptBeforeLink")} <Link href="/privacy#choices">{t("keptLink")}</Link>.
      </p>
    );
  }

  if (!asking) {
    return (
      <div className="keep-photo">
        <Button variant="quiet" size="small" onClick={() => setAsking(true)}>
          {t("keepThisPhoto")}
        </Button>
      </div>
    );
  }

  if (gating) {
    return (
      <GrownUpGate
        reason={tp("gateKeepPhoto")}
        onPass={() => {
          setGating(false);
          keepNow();
        }}
        onCancel={() => {
          setGating(false);
          setAsking(false);
        }}
      />
    );
  }

  return (
    <section aria-labelledby="keep-photo-heading" className="keep-photo keep-photo--asking">
      <h3 id="keep-photo-heading">{t("keepHeading")}</h3>
      <p>{t("keepExplain")}</p>
      <div className="keep-photo__actions">
        <Button
          size="small"
          disabled={keep.isPending}
          // A child's photo is kept only with a grown-up's say-so.
          onClick={() => (pathway === "child" ? setGating(true) : keepNow())}
        >
          {t("keepIt")}
        </Button>
        <Button variant="quiet" size="small" onClick={() => setAsking(false)}>
          {t("notNow")}
        </Button>
      </div>
      {keep.error ? <p role="alert">{errorText(keep.error.message)}</p> : null}
    </section>
  );
}
