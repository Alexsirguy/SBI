"use client";

import { Button } from "@sbi/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { api } from "../api";
import { choicesSnapshot, subscribeToChoices } from "../consent";
import { useErrorText } from "../i18n/error-text";
import { useT } from "../i18n/provider";
import { ClassesOverview } from "./dashboard/classes-overview";
import { OfflineSection } from "./dashboard/offline-section";
import { SavedLessonsSection } from "./dashboard/saved-lessons-section";
import { AccountSettings } from "./dashboard/settings";
import { TeachInvite } from "./dashboard/teach-invite";
import { useAccount } from "./use-account";

/** Signed-in home; on phones learning comes before housekeeping, on desktop they sit side by side. */
export function AccountPanel() {
  const errorText = useErrorText();
  const t = useT("account");
  const router = useRouter();
  const account = useAccount();
  const snapshot = useSyncExternalStore(
    subscribeToChoices,
    () => choicesSnapshot(),
    () => null,
  );
  const resend = useMutation({ mutationFn: () => api("resendVerification", {}) });

  // Signed out (or after signing out): the account link leads to sign-in instead.
  useEffect(() => {
    if (account.data === null) router.replace("/account/sign-in");
  }, [account.data, router]);

  if (account.error) return <p role="alert">{errorText(account.error.message)}</p>;
  if (!account.data || snapshot === null) return <p role="status">{t("accountChecking")}</p>;

  const me = account.data;
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
            {me.educatorPending ? <p>{t("educatorPendingNotice")}</p> : null}
            <Button
              variant="quiet"
              size="small"
              disabled={resend.isPending || resend.isSuccess}
              onClick={() => resend.mutate()}
            >
              {resend.isSuccess ? t("accountLinkSent") : t("accountSendLinkAgain")}
            </Button>
            {resend.error ? <p role="alert">{errorText(resend.error.message)}</p> : null}
          </div>
        )}
      </div>
      <div className="account-dash">
        {me.educator ? <ClassesOverview /> : null}
        <SavedLessonsSection educator={me.educator} />
        <OfflineSection />
        {me.educator || me.educatorPending ? null : <TeachInvite />}
      </div>
      <AccountSettings me={me} />
    </>
  );
}
