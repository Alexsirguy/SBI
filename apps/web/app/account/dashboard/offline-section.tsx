"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "../../i18n/provider";
import { devicePacks, type PackStore, type PackSummary } from "../../offline/packs";

const SHOWN = 3;

/** Packs live on this device, not the account, so the section says so and hides when empty. */
export function OfflineSection({ store = devicePacks }: { store?: PackStore }) {
  const t = useT("account");
  const [packs, setPacks] = useState<PackSummary[]>([]);

  useEffect(() => {
    let live = true;
    // A browser without IndexedDB simply has nothing saved for offline.
    store.list().then(
      (found) => live && setPacks(found),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [store]);

  if (packs.length === 0) return null;
  return (
    <section className="account-card" aria-labelledby="account-offline">
      <h2 id="account-offline">{t("dashOfflineHeading")}</h2>
      <p className="account-card__hint">{t("dashOfflineIntro")}</p>
      <ul className="saved-list">
        {packs.slice(0, SHOWN).map((pack) => (
          <li key={pack.lessonId}>
            <Link href={`/offline?id=${pack.lessonId}`}>{pack.title}</Link>
          </li>
        ))}
      </ul>
      <Link href="/offline" className="account-card__row">
        {t("dashOfflineLink")}
      </Link>
    </section>
  );
}
