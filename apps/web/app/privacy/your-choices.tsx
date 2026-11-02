"use client";

import { Button } from "@sbi/ui";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { webEnv } from "../../env";
import { useDeletePhoto } from "../capture/use-photo-upload";
import {
  choicesSnapshot,
  forgetKeptPhoto,
  hasConsent,
  readKeptPhotos,
  setConsent,
  subscribeToChoices,
} from "../consent";

const DATE = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/** What this device has agreed to, the photos it kept, and a way to take either back. */
export function YourChoices() {
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
      <h2 id="choices">Your choices</h2>
      <p>
        Each choice is separate and starts off. We only ask for one when there is something it would
        do, and you can change your mind here at any time.
      </p>
      <h3>Keeping photos</h3>
      {!state ? null : state.saving || state.kept.length > 0 ? (
        <>
          <p>You chose to keep photos. They stay in private storage until you delete them.</p>
          {state.kept.length > 0 ? (
            <ul className="kept-photos">
              {state.kept.map((photo) => (
                <li key={photo.key}>
                  <span>
                    {photo.label}, kept {DATE.format(new Date(photo.keptAt))}
                  </span>
                  <Button
                    variant="quiet"
                    size="small"
                    disabled={remove.isPending}
                    onClick={() => void deleteOne(photo.key)}
                  >
                    Delete
                    <span className="sbi-visually-hidden"> {photo.label}</span>
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <Button variant="quiet" disabled={remove.isPending} onClick={() => void stopKeeping()}>
            Stop keeping photos and delete them
          </Button>
        </>
      ) : (
        <p>
          Off. Photos are deleted about an hour after we recognise them. You can choose to keep one
          after it is recognised.
        </p>
      )}
      {webEnv.auth ? (
        <>
          <h3>Linking to an account</h3>
          {state ? (
            <p>
              {state.linked
                ? "On. This device's kept photos are tied to your account."
                : "Off. Accounts are optional, and linking is a separate choice."}{" "}
              <Link href="/account">Change this on your account page</Link>.
            </p>
          ) : null}
        </>
      ) : null}
      <div role="status">{remove.isSuccess ? <p>Deleted.</p> : null}</div>
      {remove.error ? <p role="alert">{remove.error.message}</p> : null}
    </section>
  );
}
