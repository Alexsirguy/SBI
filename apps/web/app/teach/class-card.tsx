"use client";

import type { TeacherClass } from "@sbi/contracts";
import { VisuallyHidden } from "@sbi/ui";
import Link from "next/link";
import { useT } from "../i18n/provider";
import { LatestWeek } from "./class-summary";

export const CLASS_TABS = ["edit", "lessons", "controls"] as const;
export type ClassTab = (typeof CLASS_TABS)[number];
export const TAB_KEY = { edit: "tabEdit", lessons: "tabLessons", controls: "tabControls" } as const;

export const classHref = (classId: string, tab: ClassTab) =>
  `/teach/class?id=${classId}&tab=${tab}`;

/** "Nigeria · SSS2", or nothing when the class has no curriculum. */
export function useClassLevel(item: Pick<TeacherClass, "curriculum" | "level"> | undefined) {
  const t = useT("teach");
  if (!item?.curriculum) return null;
  const name = t(item.curriculum === "us" ? "curriculumUs" : "curriculumNg");
  return item.level ? `${name} · ${item.level}` : name;
}

/** One class on the list: a glance at it, and a way into each part of its page (#410). */
export function ClassCard({ item }: { item: TeacherClass }) {
  const t = useT("teach");
  const level = useClassLevel(item);
  const archived = !!item.archivedAt;
  const tabs: readonly ClassTab[] = archived ? ["edit"] : CLASS_TABS;

  return (
    <li className="teach-card">
      <h2 className="teach-card__name">
        {item.name}
        {archived ? <span className="teach-tag"> · {t("archivedTag")}</span> : null}
      </h2>
      <p className="teach-card__meta">
        {level ? <span>{level}</span> : null}
        <span>{t("codeHint", { hint: item.codeHint })}</span>
        <span>
          {item.lessons.length === 1
            ? t("dashLessonOne")
            : t("dashLessonOther", { count: item.lessons.length })}
        </span>
        {archived ? null : <LatestWeek classId={item.classId} />}
      </p>
      <p className="teach-card__actions">
        {tabs.map((tab) => (
          <Link
            key={tab}
            href={classHref(item.classId, tab)}
            className="sbi-button sbi-button--quiet sbi-button--small"
          >
            {t(TAB_KEY[tab])}
            <VisuallyHidden>: {item.name}</VisuallyHidden>
          </Link>
        ))}
      </p>
    </li>
  );
}
