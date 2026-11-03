"use client";

import { Button } from "@sbi/ui";
import { useMemo, useSyncExternalStore } from "react";
import { WhoIsLearning } from "../pathway/who-is-learning";
import { useDeletePhoto } from "../capture/use-photo-upload";
import { ConsentRequests } from "../consent-requests";
import { choicesSnapshot, forgetKeptPhoto, readKeptPhotos, subscribeToChoices } from "../consent";
import { INTL_LOCALE } from "../i18n/locales";
import { useLocale, useT } from "../i18n/provider";
import { useErrorText } from "../i18n/error-text";

/** Every consent request with its answer, and the photos this device kept, each deletable. */
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
  const kept = snapshot === null ? [] : readKeptPhotos();
  const remove = useDeletePhoto();

  const deleteOne = async (key: string) => {
    await remove.mutateAsync(key);
    forgetKeptPhoto(key);
  };

  return (
    <section aria-labelledby="choices" className="your-choices">
      <h2 id="choices">{t("choicesHeading")}</h2>
      <p>{t("choicesIntro")}</p>
      <WhoIsLearning compact />
      <ConsentRequests />
      {kept.length > 0 ? (
        <>
          <h3>{t("choicesKeepingHeading")}</h3>
          <ul className="kept-photos">
            {kept.map((photo) => (
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
        </>
      ) : null}
      <div role="status">{remove.isSuccess ? <p>{t("choicesDeleted")}</p> : null}</div>
      {remove.error ? <p role="alert">{errorText(remove.error.message)}</p> : null}
    </section>
  );
}
