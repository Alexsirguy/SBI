"use client";

import { CONSENT_VERSION } from "@sbi/contracts";
import { Button } from "@sbi/ui";
import Link from "next/link";
import { useState } from "react";
import { rememberKeptPhoto, setConsent } from "../consent";
import { useKeepPhoto } from "./use-photo-upload";

/** The save-photos opt-in, asked at the moment it matters and never ticked in advance (spec §12). */
export function KeepPhoto({ photoKey, label }: { photoKey: string; label: string }) {
  const [asking, setAsking] = useState(false);
  const keep = useKeepPhoto();

  if (keep.isSuccess) {
    return (
      <p role="status" className="keep-photo">
        Photo kept. You can delete it any time from{" "}
        <Link href="/privacy#choices">your privacy choices</Link>.
      </p>
    );
  }

  if (!asking) {
    return (
      <div className="keep-photo">
        <Button variant="quiet" size="small" onClick={() => setAsking(true)}>
          Keep this photo
        </Button>
      </div>
    );
  }

  return (
    <section aria-labelledby="keep-photo-heading" className="keep-photo keep-photo--asking">
      <h3 id="keep-photo-heading">Keep this photo?</h3>
      <p>
        Otherwise it is deleted about an hour after we recognise it. If you keep it, we store it
        privately until you delete it. It is never shown to anyone else and never used to train AI.
        Only this device can find it again, from your privacy choices.
      </p>
      <div className="keep-photo__actions">
        <Button
          size="small"
          disabled={keep.isPending}
          onClick={() => {
            setConsent("save-photos", true);
            keep.mutate(
              { key: photoKey, consentVersion: CONSENT_VERSION },
              {
                onSuccess: () =>
                  rememberKeptPhoto({ key: photoKey, label, keptAt: new Date().toISOString() }),
              },
            );
          }}
        >
          Keep it
        </Button>
        <Button variant="quiet" size="small" onClick={() => setAsking(false)}>
          Not now
        </Button>
      </div>
      {keep.error ? <p role="alert">{keep.error.message}</p> : null}
    </section>
  );
}
