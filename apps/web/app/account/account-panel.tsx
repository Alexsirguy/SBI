"use client";

import { Button } from "@sbi/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { api } from "../api";
import {
  choicesSnapshot,
  hasConsent,
  readKeptPhotos,
  setConsent,
  subscribeToChoices,
} from "../consent";
import { accountSession } from "./account-session";

const SIGNED_IN = ["account", "signed-in"];
const ACCOUNT = ["account", "profile"];

/** Signing in is optional; linking this device's kept photos is a separate, explicit choice. */
export function AccountPanel() {
  const client = useQueryClient();
  const session = accountSession;
  const snapshot = useSyncExternalStore(
    subscribeToChoices,
    () => choicesSnapshot(),
    () => null,
  );
  const signedIn = useQuery({
    enabled: !!session,
    queryFn: () => session?.signedIn() ?? false,
    queryKey: SIGNED_IN,
  });
  const account = useQuery({
    enabled: signedIn.data === true,
    queryFn: () => api("getAccount", {}),
    queryKey: ACCOUNT,
  });
  const link = useMutation({
    mutationFn: async () => {
      const consent = setConsent("account", true);
      return api("linkAccount", {
        consent,
        photoKeys: readKeptPhotos().map((photo) => photo.key),
      });
    },
    onError: () => setConsent("account", false),
    onSuccess: () => client.invalidateQueries({ queryKey: ACCOUNT }),
  });
  const unlink = useMutation({
    mutationFn: async () => {
      await api("unlinkAccount", {});
      setConsent("account", false);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ACCOUNT }),
  });

  if (!session) {
    return (
      <p>
        Accounts are not available on this site. Everything works without one, and your choices are
        kept on this device.
      </p>
    );
  }
  if (signedIn.isPending || snapshot === null) return <p role="status">Checking sign-in…</p>;

  if (!signedIn.data) {
    return (
      <>
        <p>
          You never need an account. If you make one, we keep only an id from the sign-in service,
          not your name or email.
        </p>
        <Button onClick={() => void session.signIn("/account")}>
          Sign in or create an account
        </Button>
      </>
    );
  }

  const kept = readKeptPhotos().length;
  const linked = !!account.data?.linkedAt && hasConsent("account");
  const busy = link.isPending || unlink.isPending;
  const error = account.error ?? link.error ?? unlink.error;

  return (
    <>
      <p>You are signed in.</p>
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
          <Button disabled={busy || !account.data} onClick={() => link.mutate()}>
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
        <Button variant="quiet" disabled={busy} onClick={() => void session.signOut()}>
          Sign out
        </Button>
      </p>
    </>
  );
}
