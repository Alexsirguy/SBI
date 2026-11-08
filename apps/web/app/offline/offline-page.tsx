"use client";

import { LessonPack } from "@sbi/contracts";
import { Button, StatusLine } from "@sbi/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import { INTL_LOCALE } from "../i18n/locales";
import { useLocale, useT } from "../i18n/provider";
import { saveFile } from "../save-file";
import { OfflineLesson } from "./offline-lesson";
import { devicePacks, packFileName, type PackStore, type PackSummary } from "./packs";
import { enableOffline } from "./service-worker";

/** Lessons saved on this device: open, download, remove, or add one from a file (#116). */
export function OfflinePage({ store = devicePacks }: { store?: PackStore }) {
  const t = useT("offline");
  const locale = useLocale();
  const router = useRouter();
  const id = useSearchParams().get("id");
  const inputId = useId();
  const [packs, setPacks] = useState<PackSummary[]>();
  const [opened, setOpened] = useState<LessonPack | null>();
  const [message, setMessage] = useState<{ kind: "status" | "alert"; text: string }>();

  const refresh = useCallback(
    () =>
      store.list().then(setPacks, () => {
        setPacks([]);
        setMessage({ kind: "alert", text: t("unavailable") });
      }),
    [store, t],
  );

  useEffect(() => {
    void enableOffline().catch(() => undefined);
  }, []);
  useEffect(() => {
    if (id)
      void store.get(id).then(
        (pack) => setOpened(pack ?? null),
        () => setOpened(null),
      );
    else void refresh();
  }, [id, store, refresh]);

  if (id) {
    if (opened === undefined) return <StatusLine>{t("loading")}</StatusLine>;
    if (opened === null) {
      return (
        <main id="main" className="prose-page">
          <h1>{t("heading")}</h1>
          <p role="alert">{t("notFound")}</p>
          <Link href="/offline">{t("backToList")}</Link>
        </main>
      );
    }
    return <OfflineLesson pack={opened} />;
  }

  const date = (iso: string) =>
    new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "long" }).format(new Date(iso));

  return (
    <main id="main" className="prose-page">
      <h1>{t("heading")}</h1>
      <p className="home__lead">{t("lead")}</p>
      {packs === undefined ? (
        <StatusLine>{t("loading")}</StatusLine>
      ) : packs.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <ul className="offline-list">
          {packs.map((pack) => (
            <li key={pack.lessonId} className="account-card">
              <Link href={`/offline?id=${pack.lessonId}`}>{pack.title}</Link>
              <span className="account-card__hint">
                {t("savedOn", { date: date(pack.savedAt) })}
              </span>
              <span className="offline-list__actions">
                <Button
                  variant="quiet"
                  size="small"
                  onClick={async () => {
                    const full = await store.get(pack.lessonId);
                    if (full) saveFile(packFileName(full), full);
                  }}
                >
                  {t("download")}
                </Button>
                <Button
                  variant="quiet"
                  size="small"
                  onClick={async () => {
                    await store.remove(pack.lessonId);
                    await refresh();
                  }}
                >
                  {t("remove", { title: pack.title })}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="account-card__hint">{t("evictionNote")}</p>
      <div className="sbi-field">
        <label htmlFor={inputId}>{t("importLabel")}</label>
        <p id={`${inputId}-hint`} className="account-card__hint">
          {t("importHint")}
        </p>
        <input
          id={inputId}
          type="file"
          accept=".json,application/json"
          aria-describedby={`${inputId}-hint`}
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0];
            if (!file) return;
            let parsed;
            try {
              parsed = LessonPack.safeParse(JSON.parse(await file.text()));
            } catch {
              parsed = undefined;
            }
            if (!parsed?.success) {
              setMessage({ kind: "alert", text: t("importBad") });
              return;
            }
            await store.save(parsed.data);
            setMessage({ kind: "status", text: t("imported") });
            router.push(`/offline?id=${parsed.data.lesson.lessonId}`);
          }}
        />
      </div>
      <p role="status">{message?.kind === "status" ? message.text : ""}</p>
      {message?.kind === "alert" ? <p role="alert">{message.text}</p> : null}
    </main>
  );
}
