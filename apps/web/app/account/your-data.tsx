"use client";

import { DeleteAccountRequest } from "@sbi/contracts";
import { Button, Disclosure, TextField } from "@sbi/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { webEnv } from "../../env";
import { api } from "../api";
import { forgetKeptPhoto, setConsent } from "../consent";
import { useT } from "../i18n/provider";

// A file the learner keeps; the browser saves it without another round trip.
function saveFile(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = Object.assign(document.createElement("a"), { download: name, href: url });
  link.click();
  URL.revokeObjectURL(url);
}

/** Download everything held for the account, or delete it all (#105). */
export function YourData({ email }: { email: string }) {
  const t = useT("account");
  const router = useRouter();
  const client = useQueryClient();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string>();
  const exported = useMutation({ mutationFn: () => api("exportAccount", {}) });
  const remove = useMutation({
    mutationFn: (confirm: string) => api("deleteAccount", { email: confirm }),
    onSuccess: ({ deletedPhotos }) => {
      // The device's own list would otherwise point at photos that no longer exist.
      for (const key of deletedPhotos) forgetKeptPhoto(key);
      setConsent("account", false);
      client.clear();
      router.replace("/account/deleted");
    },
  });

  const download = async () => {
    const bundle = await exported.mutateAsync();
    saveFile(`science-behind-it-${bundle.exportedAt.slice(0, 10)}.json`, bundle);
  };

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
    <section aria-labelledby="your-data">
      <h2 id="your-data">{t("dataHeading")}</h2>
      <p>{t("dataIntro")}</p>
      <Button variant="quiet" disabled={exported.isPending} onClick={() => void download()}>
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
      {exported.error ? <p role="alert">{exported.error.message}</p> : null}

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
          {remove.error ? <p role="alert">{remove.error.message}</p> : null}
          <Button type="submit" disabled={remove.isPending}>
            {remove.isPending ? t("dataDeleting") : t("dataDeleteAccount")}
          </Button>
        </form>
      </Disclosure>
    </section>
  );
}
