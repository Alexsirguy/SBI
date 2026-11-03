"use client";

import { DeleteAccountRequest } from "@sbi/contracts";
import { Button, Disclosure, TextField } from "@sbi/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { webEnv } from "../../env";
import { api } from "../api";
import { forgetKeptPhoto, setConsent } from "../consent";

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
      setError("Type the email of this account exactly, to confirm.");
      return;
    }
    setError(undefined);
    remove.mutate(parsed.data.email);
  };

  const photos = exported.data?.photos ?? [];
  return (
    <section aria-labelledby="your-data">
      <h2 id="your-data">Your data</h2>
      <p>
        Download a copy of everything tied to your account: your details, saved lessons and the
        photos linked to it.
      </p>
      <Button variant="quiet" disabled={exported.isPending} onClick={() => void download()}>
        {exported.isPending ? "Preparing…" : "Download your data"}
      </Button>
      <div role="status">{exported.isSuccess ? <p>Your data was saved as a file.</p> : null}</div>
      {photos.length > 0 ? (
        <ul className="your-data__photos">
          {photos.map((photo, index) => (
            <li key={photo.key}>
              <a href={`${webEnv.apiUrl.replace(/\/+$/, "")}${photo.download}`}>
                Download photo {index + 1}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {exported.error ? <p role="alert">{exported.error.message}</p> : null}

      <Disclosure summary="Delete my account">
        <form className="your-data__delete" onSubmit={confirmDelete} noValidate>
          <p>
            This deletes your account, your saved lessons, and the photos linked to it, straight
            away. It cannot be undone. Copies in our backups are gone within 30 days.
          </p>
          <TextField
            label={`Type ${email} to confirm`}
            type="email"
            autoComplete="off"
            value={typed}
            error={error}
            onChange={(event) => setTyped(event.target.value)}
          />
          {remove.error ? <p role="alert">{remove.error.message}</p> : null}
          <Button type="submit" disabled={remove.isPending}>
            {remove.isPending ? "Deleting…" : "Delete my account"}
          </Button>
        </form>
      </Disclosure>
    </section>
  );
}
