"use client";

import { DeleteAccountRequest } from "@sbi/contracts";
import { Button, Disclosure, TextField } from "@sbi/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { webEnv } from "../../env";
import { api } from "../api";
import { forgetKeptPhoto, setConsent } from "../consent";
import { useT } from "../i18n/provider";
import { useErrorText } from "../i18n/error-text";
import { saveFile } from "../save-file";

/** Download everything held for the account, or delete it all (#105). */
export function YourData({ email }: { email: string }) {
  const errorText = useErrorText();
  const router = useRouter();
  const t = useT("account");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string>();
  const exported = useMutation({ mutationFn: () => api("exportAccount", {}) });
  const remove = useMutation({
    mutationFn: (confirm: string) => api("deleteAccount", { email: confirm }),
    onSuccess: ({ deletedPhotos }) => {
      // The device's own list would otherwise point at photos that no longer exist.
      for (const key of deletedPhotos) forgetKeptPhoto(key);
      setConsent("account", false);
      // The cache is cleared by the next page, so this one never flips to "signed out" first.
      router.replace("/account/deleted");
    },
  });

  const download = () =>
    exported.mutate(undefined, {
      onSuccess: (bundle) =>
        saveFile(`science-behind-it-${bundle.exportedAt.slice(0, 10)}.json`, bundle),
    });

  const confirmDelete = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = DeleteAccountRequest.safeParse({ email: typed });
    if (!parsed.success || parsed.data.email !== email.toLowerCase()) {
      setError(t("dataConfirmMismatch"));
      return;
    }
    setError(undefined);
    remove.mutate(parsed.data.email);
  };

  const photos = exported.data?.photos ?? [];
  return (
    <section className="account-card" aria-labelledby="your-data">
      <h2 id="your-data">{t("dataHeading")}</h2>
      <p>{t("dataIntro")}</p>
      <Button variant="quiet" disabled={exported.isPending} onClick={download}>
        {exported.isPending ? t("dataPreparing") : t("dataDownload")}
      </Button>
      <div role="status">{exported.isSuccess ? <p>{t("dataSaved")}</p> : null}</div>
      {photos.length > 0 ? (
        <ul className="your-data__photos">
          {photos.map((photo, index) => (
            <li key={photo.key}>
              <a href={`${webEnv.apiUrl.replace(/\/+$/, "")}${photo.download}`}>
                {t("dataDownloadPhoto", { number: index + 1 })}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {exported.error ? <p role="alert">{errorText(exported.error.message)}</p> : null}

      <div className="account-card__danger">
        <Disclosure summary={t("dataDeleteAccount")}>
          <form className="your-data__delete" onSubmit={confirmDelete} noValidate>
            <p>{t("dataDeleteWarning")}</p>
            <TextField
              label={t("dataConfirmLabel", { email })}
              type="email"
              autoComplete="off"
              value={typed}
              error={error}
              onChange={(event) => setTyped(event.target.value)}
            />
            {remove.error ? <p role="alert">{errorText(remove.error.message)}</p> : null}
            <Button type="submit" disabled={remove.isPending}>
              {remove.isPending ? t("dataDeleting") : t("dataDeleteAccount")}
            </Button>
          </form>
        </Disclosure>
      </div>
    </section>
  );
}
