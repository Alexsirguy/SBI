"use client";

import { Button } from "@sbi/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
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
import { useT } from "../i18n/provider";
import { ACCOUNT_KEY, useAccount, useSignOut } from "./use-account";
import { YourData } from "./your-data";
import { useErrorText } from "../i18n/error-text";

/** The signed-in account; linking this device's kept photos is a separate, explicit choice. */
export function AccountPanel() {
  const errorText = useErrorText();
  const t = useT("account");
  const teachT = useT("teach");
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

  if (account.error) return <p role="alert">{errorText(account.error.message)}</p>;
  if (!account.data || snapshot === null) return <p role="status">{t("accountChecking")}</p>;

  const me = account.data;
  const kept = readKeptPhotos().length;
  const linked = !!me.linkedAt && hasConsent("account");
  const busy = link.isPending || unlink.isPending;
  const error = link.error ?? unlink.error ?? resend.error ?? signOut.error;

  const initials = `${me.firstName.charAt(0)}${me.lastName.charAt(0)}`.toUpperCase();
  return (
    <>
      <div className="account-profile">
        <span className="account-profile__mark" aria-hidden="true">
          {initials}
        </span>
        <p className="account-profile__who">
          {t("accountSignedInAs", {
            email: me.email,
            firstName: me.firstName,
            lastName: me.lastName,
          })}
        </p>
        {me.emailVerified ? null : (
          <div className="account-notice">
            <p>{t("accountConfirmEmail", { email: me.email })}</p>
            <Button
              variant="quiet"
              size="small"
              disabled={resend.isPending || resend.isSuccess}
              onClick={() => resend.mutate()}
            >
              {resend.isSuccess ? t("accountLinkSent") : t("accountSendLinkAgain")}
            </Button>
            {me.educatorPending ? <p>{t("educatorPendingNotice")}</p> : null}
          </div>
        )}
      </div>
      <div className="account-cards">
        <section className="account-card" aria-labelledby="account-saved">
          <h2 id="account-saved">{t("accountSavedHeading")}</h2>
          <Link href="/account/lessons" className="account-card__row">
            {t("accountSeeSaved")}
          </Link>
        </section>
        <section className="account-card" aria-labelledby="account-teach">
          <h2 id="account-teach">{teachT("accountCardHeading")}</h2>
          <Link href="/teach" className="account-card__row">
            {teachT("accountCardLink")}
          </Link>
        </section>
        <section className="account-card" aria-labelledby="account-link">
          <h2 id="account-link">{t("accountLinkHeading")}</h2>
          {linked ? (
            <>
              <p>{t("accountLinkedText")}</p>
              <Button variant="quiet" disabled={busy} onClick={() => unlink.mutate()}>
                {t("accountUnlinkButton")}
              </Button>
            </>
          ) : (
            <>
              <p>
                {kept === 0
                  ? t("accountLinkOffNone")
                  : kept === 1
                    ? t("accountLinkOffOne")
                    : t("accountLinkOffOther", { count: kept })}
              </p>
              {me.emailVerified ? null : (
                <p className="account-card__hint">{t("accountConfirmFirst")}</p>
              )}
              <Button disabled={busy || !me.emailVerified} onClick={() => link.mutate()}>
                {t("accountLinkButton")}
              </Button>
            </>
          )}
          <div role="status">
            {link.isSuccess && linked ? <p>{t("accountLinked")}</p> : null}
            {unlink.isSuccess && !linked ? <p>{t("accountUnlinked")}</p> : null}
          </div>
          {error ? <p role="alert">{errorText(error.message)}</p> : null}
        </section>
        <YourData email={me.email} />
      </div>
      <p className="account-signout">
        <Button variant="quiet" disabled={signOut.isPending} onClick={() => signOut.mutate()}>
          {t("accountSignOut")}
        </Button>
      </p>
    </>
  );
}
