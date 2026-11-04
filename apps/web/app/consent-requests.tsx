"use client";

import type { ConsentPurpose } from "@sbi/contracts";
import { Button } from "@sbi/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState, useSyncExternalStore } from "react";
import { ACCOUNT_KEY, useAccount } from "./account/use-account";
import { api } from "./api";
import {
  CONSENT_PURPOSES,
  choicesSnapshot,
  consentChoice,
  forgetKeptPhoto,
  readKeptPhotos,
  setConsent,
  subscribeToChoices,
} from "./consent";
import { useErrorText } from "./i18n/error-text";
import { useT } from "./i18n/provider";
import { GrownUpGate } from "./pathway/grown-up-gate";
import type { Pathway } from "./pathway/pathway";
import { usePathway } from "./pathway/provider";
import { forgetVisit } from "./analytics/track";

type Answers = Partial<Record<ConsentPurpose, boolean>>;

const COPY = {
  "save-photos": ["consentSavePhotosTitle", "consentSavePhotosText"],
  account: ["consentAccountTitle", "consentAccountText"],
  "model-improvement": ["consentModelTitle", "consentModelText"],
  research: ["consentResearchTitle", "consentResearchText"],
  "usage-statistics": ["consentUsageTitle", "consentUsageText"],
} as const;

/** Under-13s are never asked for usage statistics, so it isn't listed for them (ADR 0026). */
export function askedPurposes(pathway: Pathway | undefined): ConsentPurpose[] {
  return CONSENT_PURPOSES.filter(
    (purpose) => !(purpose === "usage-statistics" && pathway === "child"),
  );
}

/** How many requests are still unanswered on this device; null before the browser is known. */
export function useUnanswered(): number | null {
  const { pathway } = usePathway();
  const snapshot = useSyncExternalStore(subscribeToChoices, choicesSnapshot, () => null);
  if (snapshot === null) return null;
  return askedPurposes(pathway).filter((purpose) => consentChoice(purpose) === undefined).length;
}

/** Every consent request with its own Accept and Decline; an unanswered one counts as no. */
export function ConsentRequests({ headingLevel = 3 }: { headingLevel?: 3 | 4 }) {
  const t = useT("site");
  const errorText = useErrorText();
  const client = useQueryClient();
  const account = useAccount();
  const { pathway } = usePathway();
  const ids = useId();
  const [gated, setGated] = useState<Answers | null>(null);
  const snapshot = useSyncExternalStore(subscribeToChoices, choicesSnapshot, () => null);

  // Answers that change what is stored act on it now: declining deletes, accepting links.
  const apply = useMutation({
    mutationFn: async (answers: Answers) => {
      for (const purpose of CONSENT_PURPOSES) {
        const allowed = answers[purpose];
        if (allowed === undefined) continue;
        if (purpose === "save-photos" && !allowed) {
          for (const photo of readKeptPhotos()) {
            await api("deletePhoto", { key: photo.key });
            forgetKeptPhoto(photo.key);
          }
        }
        const me = account.data;
        if (purpose === "account" && allowed && me?.emailVerified && !me.linkedAt) {
          try {
            await api("linkAccount", {
              consent: setConsent("account", true),
              photoKeys: readKeptPhotos().map((photo) => photo.key),
            });
          } catch (error) {
            setConsent("account", false);
            throw error;
          }
        }
        if (purpose === "account" && !allowed && me?.linkedAt) await api("unlinkAccount", {});
        if (purpose === "usage-statistics" && !allowed) forgetVisit();
        setConsent(purpose, allowed);
      }
    },
    onSettled: () => client.invalidateQueries({ queryKey: ACCOUNT_KEY }),
  });

  // A child's yes waits for a grown-up; a no never does.
  const asked = askedPurposes(pathway);
  const answer = (answers: Answers) => {
    const accepting = Object.values(answers).some(Boolean);
    if (accepting && pathway === "child") setGated(answers);
    else apply.mutate(answers);
  };
  const all = (allowed: boolean) =>
    answer(Object.fromEntries(asked.map((purpose) => [purpose, allowed])));

  if (snapshot === null) return null;

  if (gated) {
    return (
      <GrownUpGate
        reason={t("consentGate")}
        onPass={() => {
          apply.mutate(gated);
          setGated(null);
        }}
        onCancel={() => setGated(null)}
      />
    );
  }

  const Heading = `h${headingLevel}` as const;
  const signedIn = Boolean(account.data);
  const kept = readKeptPhotos().length;

  return (
    <div className="consent-requests">
      <p className="consent-requests__intro">{t("consentIntro")}</p>
      <div className="consent-requests__all">
        <Button variant="quiet" size="small" disabled={apply.isPending} onClick={() => all(true)}>
          {t("consentAcceptAll")}
        </Button>
        <Button variant="quiet" size="small" disabled={apply.isPending} onClick={() => all(false)}>
          {t("consentDeclineAll")}
        </Button>
      </div>
      <ul className="consent-requests__list">
        {asked.map((purpose) => {
          const choice = consentChoice(purpose);
          const [title, text] = COPY[purpose];
          const titleId = `${ids}-${purpose}`;
          return (
            <li key={purpose} className="consent-request" data-choice={String(choice)}>
              <Heading id={titleId} className="consent-request__title">
                {t(title)}
              </Heading>
              <p className="consent-request__text">
                {t(text)}
                {purpose === "save-photos" && kept > 0
                  ? ` ${t("consentSavePhotosKept", { count: kept })}`
                  : null}
                {purpose === "account" && !signedIn ? ` ${t("consentAccountSignIn")}` : null}
              </p>
              <div className="consent-request__row">
                <div role="group" aria-labelledby={titleId} className="consent-request__answer">
                  <button
                    type="button"
                    aria-pressed={choice === true}
                    disabled={apply.isPending}
                    onClick={() => answer({ [purpose]: true })}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                      <path d="M2.5 7.5 L5.5 10.5 L11.5 3.5" />
                    </svg>
                    {t("consentAccept")}
                  </button>
                  <button
                    type="button"
                    aria-pressed={choice === false}
                    disabled={apply.isPending}
                    onClick={() => answer({ [purpose]: false })}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                      <path d="M3.5 3.5 L10.5 10.5 M10.5 3.5 L3.5 10.5" />
                    </svg>
                    {t("consentDecline")}
                  </button>
                </div>
                {choice === undefined ? (
                  <span className="consent-request__unanswered">{t("consentUnanswered")}</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <div role="status" className="consent-requests__status">
        {apply.isSuccess ? t("consentSaved") : null}
      </div>
      {apply.error ? <p role="alert">{errorText(apply.error.message)}</p> : null}
    </div>
  );
}
