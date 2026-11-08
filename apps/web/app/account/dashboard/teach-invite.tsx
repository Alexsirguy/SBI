"use client";

import Link from "next/link";
import { useT } from "../../i18n/provider";

/** Learners get a quiet way in to teaching tools rather than a card for something they don't use. */
export function TeachInvite() {
  const t = useT("account");
  return (
    <p className="account-dash__invite">
      {t("dashTeachInvite")} <Link href="/teach">{t("dashTeachInviteLink")}</Link>
    </p>
  );
}
