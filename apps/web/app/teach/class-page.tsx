"use client";

import { StatusLine } from "@sbi/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAccount } from "../account/use-account";
import { useT } from "../i18n/provider";
import { useErrorText } from "../lesson/lesson-t";
import { CLASS_TABS, classHref, TAB_KEY, useClassLevel, type ClassTab } from "./class-card";
import { ArchiveClass, ControlsPanel, EditPanel, LessonsPanel } from "./class-panels";
import { ClassSummaryTable } from "./class-summary";
import { useClasses } from "./use-classes";

const isTab = (value: string | null): value is ClassTab =>
  (CLASS_TABS as readonly string[]).includes(value ?? "");

/** One class: its overview on top, then one job at a time in tabs (#410). */
export function ClassPage() {
  const t = useT("teach");
  const errorText = useErrorText();
  const params = useSearchParams();
  const classId = params.get("id") ?? "";
  const requested = params.get("tab");
  const tab: ClassTab = isTab(requested) ? requested : "lessons";
  const account = useAccount();
  const signedIn = !!account.data;
  const classes = useClasses(signedIn);
  const item = classes.data?.classes.find((each) => each.classId === classId);
  const level = useClassLevel(item);

  const back = (
    <p className="teach-back">
      <Link href="/teach">← {t("allClasses")}</Link>
    </p>
  );

  if (account.isPending || (signedIn && classes.isPending)) {
    return <StatusLine>{t("checking")}</StatusLine>;
  }
  if (!signedIn) {
    const next = encodeURIComponent(classHref(classId, tab));
    return (
      <p>
        {t("signInFirst")} <Link href={`/account/sign-in?next=${next}`}>{t("signIn")}</Link>
      </p>
    );
  }
  if (classes.isError || !classes.data) {
    return <p role="alert">{errorText(classes.error?.message)}</p>;
  }
  if (!item) {
    return (
      <>
        {back}
        <h1>{t("classNotFound")}</h1>
      </>
    );
  }

  return (
    <>
      {back}
      <h1>
        {item.name}
        {item.archivedAt ? <span className="teach-tag"> · {t("archivedTag")}</span> : null}
      </h1>
      <p className="teach-card__meta">
        {level ? <span>{level}</span> : null}
        <span>{t("codeHint", { hint: item.codeHint })}</span>
      </p>
      {item.archivedAt ? (
        <ArchiveClass item={item} />
      ) : (
        <>
          <div className="account-card teach-overview">
            <ClassSummaryTable classId={item.classId} />
          </div>
          <nav className="teach-tabs" aria-label={t("classTabs")}>
            {CLASS_TABS.map((each) => (
              <Link
                key={each}
                href={classHref(item.classId, each)}
                replace
                scroll={false}
                aria-current={each === tab ? "page" : undefined}
              >
                {t(TAB_KEY[each])}
              </Link>
            ))}
          </nav>
          <div className="account-card">
            {/* Keyed by class, so switching classes starts each form from that class's values. */}
            {tab === "edit" ? <EditPanel key={item.classId} item={item} /> : null}
            {tab === "lessons" ? <LessonsPanel key={item.classId} item={item} /> : null}
            {tab === "controls" ? <ControlsPanel key={item.classId} item={item} /> : null}
          </div>
        </>
      )}
    </>
  );
}
