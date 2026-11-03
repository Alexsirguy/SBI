"use client";

import { Button } from "@sbi/ui";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { WhoIsLearning } from "../pathway/who-is-learning";
import { useDeletePhoto } from "../capture/use-photo-upload";
import {
  choicesSnapshot,
  forgetKeptPhoto,
  hasConsent,
  readKeptPhotos,
  setConsent,
  subscribeToChoices,
} from "../consent";
import { INTL_LOCALE } from "../i18n/locales";
import { useLocale, useT } from "../i18n/provider";
import { useErrorText } from "../i18n/error-text";

/** What this device has agreed to, the photos it kept, and a way to take either back. */
export function YourChoices() {
  const errorText = useErrorText();
  const t = useT("site");
  const locale = useLocale();
  const date = useMemo(
    () => new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "medium" }),
    [locale],
  );
  // Storage exists only in the browser, so the server renders nothing for this part.
  const snapshot = useSyncExternalStore(
    subscribeToChoices,
    () => choicesSnapshot(),
    () => null,
  );
  const state =
    snapshot === null
      ? undefined
      : {
          kept: readKeptPhotos(),
          linked: hasConsent("account"),
          saving: hasConsent("save-photos"),
        };
  const remove = useDeletePhoto();

  const deleteOne = async (key: string) => {
    await remove.mutateAsync(key);
    forgetKeptPhoto(key);
  };

  // Withdrawing consent deletes what it covered, not just future photos.
  const stopKeeping = async () => {
    for (const photo of readKeptPhotos()) await deleteOne(photo.key);
    setConsent("save-photos", false);
  };

  return (
    <section aria-labelledby="choices" className="your-choices">
      <h2 id="choices">{t("choicesHeading")}</h2>
      <p>{t("choicesIntro")}</p>
      <WhoIsLearning compact />
      <h3>{t("choicesKeepingHeading")}</h3>
      {!state ? null : state.saving || state.kept.length > 0 ? (
        <>
          <p>{t("choicesKeepingOn")}</p>
          {state.kept.length > 0 ? (
            <ul className="kept-photos">
              {state.kept.map((photo) => (
                <li key={photo.key}>
                  <span>
                    {t("choicesKeptPhoto", {
                      date: date.format(new Date(photo.keptAt)),
                      label: photo.label,
                    })}
                  </span>
                  <Button
                    variant="quiet"
                    size="small"
                    disabled={remove.isPending}
                    onClick={() => void deleteOne(photo.key)}
                  >
                    {t("choicesDelete")}
                    <span className="sbi-visually-hidden"> {photo.label}</span>
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <Button variant="quiet" disabled={remove.isPending} onClick={() => void stopKeeping()}>
            {t("choicesStopKeeping")}
          </Button>
        </>
      ) : (
        <p>{t("choicesKeepingOff")}</p>
      )}
      <h3>{t("choicesLinkingHeading")}</h3>
      {state ? (
        <p>
          {state.linked ? t("choicesLinkingOn") : t("choicesLinkingOff")}{" "}
          <Link href="/account">{t("choicesLinkingChange")}</Link>.
        </p>
      ) : null}
      <div role="status">{remove.isSuccess ? <p>{t("choicesDeleted")}</p> : null}</div>
      {remove.error ? <p role="alert">{errorText(remove.error.message)}</p> : null}
    </section>
  );
}
