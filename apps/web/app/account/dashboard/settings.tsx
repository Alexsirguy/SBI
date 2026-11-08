"use client";

import type { ApiResponse } from "@sbi/contracts";
import { Button } from "@sbi/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api";
import { hasConsent, readKeptPhotos, setConsent } from "../../consent";
import { useErrorText } from "../../i18n/error-text";
import { useT } from "../../i18n/provider";
import { ACCOUNT_KEY, useSignOut } from "../use-account";
import { YourData } from "../your-data";
import { InfoButton } from "./info-button";

/** Account housekeeping, kept apart from the learning sections; linking stays an explicit choice. */
export function AccountSettings({ me }: { me: ApiResponse<"getAccount"> }) {
  const t = useT("account");
  const errorText = useErrorText();
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: ACCOUNT_KEY });
  const signOut = useSignOut();
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

  const kept = readKeptPhotos().length;
  const linked = !!me.linkedAt && hasConsent("account");
  const busy = link.isPending || unlink.isPending;
  const error = link.error ?? unlink.error ?? signOut.error;

  return (
    <div className="account-settings">
      <section className="account-card" aria-labelledby="account-link">
        <div className="account-card__title">
          <h2 id="account-link">{t("accountLinkHeading")}</h2>
          <InfoButton topic={t("accountLinkHeading")}>
            <p>
              {linked
                ? t("accountLinkedText")
                : kept === 0
                  ? t("accountLinkOffNone")
                  : kept === 1
                    ? t("accountLinkOffOne")
                    : t("accountLinkOffOther", { count: kept })}
            </p>
          </InfoButton>
        </div>
        {linked ? (
          <>
            <p>{t("accountLinkShortOn")}</p>
            <Button variant="quiet" disabled={busy} onClick={() => unlink.mutate()}>
              {t("accountUnlinkButton")}
            </Button>
          </>
        ) : (
          <>
            <p>{t("accountLinkShortOff")}</p>
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
      <p className="account-signout">
        <Button variant="quiet" disabled={signOut.isPending} onClick={() => signOut.mutate()}>
          {t("accountSignOut")}
        </Button>
      </p>
    </div>
  );
}
