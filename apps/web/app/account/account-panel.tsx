"use client";

import { Button } from "@sbi/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { api } from "../api";
import {
  choicesSnapshot,
  hasConsent,
  readKeptPhotos,
  setConsent,
  subscribeToChoices,
} from "../consent";
import { ACCOUNT_KEY, useAccount, useSignOut } from "./use-account";

/** The signed-in account; linking this device's kept photos is a separate, explicit choice. */
export function AccountPanel() {
  const router = useRouter();
  const client = useQueryClient();
  const account = useAccount();
  const snapshot = useSyncExternalStore(
    subscribeToChoices,
    () => choicesSnapshot(),
    () => null,
  );
  const refresh = () => client.invalidateQueries({ queryKey: ACCOUNT_KEY });
  const signOut = useSignOut();
  const resend = useMutation({ mutationFn: () => api("resendVerification", {}) });
  const link = useMutation({
    mutationFn: () =>
      api("linkAccount", {
        consent: setConsent("account", true),
        photoKeys: readKeptPhotos().map((photo) => photo.key),
      }),
    onError: () => setConsent("account", false),
    onSuccess: refresh,
  });
  const unlink = useMutation({
    mutationFn: async () => {
      await api("unlinkAccount", {});
      setConsent("account", false);
    },
    onSuccess: refresh,
  });

  // Signed out (or after signing out): the account link leads to sign-in instead.
  useEffect(() => {
    if (account.data === null) router.replace("/account/sign-in");
  }, [account.data, router]);

  if (account.error) return <p role="alert">{account.error.message}</p>;
  if (!account.data || snapshot === null) return <p role="status">Checking sign-in…</p>;

  const me = account.data;
  const kept = readKeptPhotos().length;
  const linked = !!me.linkedAt && hasConsent("account");
  const busy = link.isPending || unlink.isPending;
  const error = link.error ?? unlink.error ?? resend.error ?? signOut.error;

  return (
    <>
      <p>
        Signed in as {me.firstName} {me.lastName} ({me.email}).
      </p>
      {me.emailVerified ? null : (
        <div className="account-notice">
          <p>Please confirm your email. We sent a link to {me.email}.</p>
          <Button
            variant="quiet"
            size="small"
            disabled={resend.isPending || resend.isSuccess}
            onClick={() => resend.mutate()}
          >
            {resend.isSuccess ? "Link sent" : "Send the link again"}
          </Button>
        </div>
      )}
      <h2>Link this device</h2>
      {linked ? (
        <>
          <p>
            This device is linked. The photos you kept here are tied to your account, not just to
            this browser.
          </p>
          <Button variant="quiet" disabled={busy} onClick={() => unlink.mutate()}>
            Unlink this device
          </Button>
        </>
      ) : (
        <>
          <p>
            Off. Linking ties the {kept === 1 ? "photo" : "photos"} you kept on this device
            {kept > 0 ? ` (${kept})` : ""} to your account, so clearing this browser does not leave
            {kept === 1 ? " it" : " them"} behind. You can unlink at any time.
          </p>
          {me.emailVerified ? null : <p>Confirm your email first.</p>}
          <Button disabled={busy || !me.emailVerified} onClick={() => link.mutate()}>
            Link this device
          </Button>
        </>
      )}
      <div role="status">
        {link.isSuccess && linked ? <p>Linked.</p> : null}
        {unlink.isSuccess && !linked ? <p>Unlinked.</p> : null}
      </div>
      {error ? <p role="alert">{error.message}</p> : null}
      <p>
        <Button variant="quiet" disabled={signOut.isPending} onClick={() => signOut.mutate()}>
          Sign out
        </Button>
      </p>
    </>
  );
}
