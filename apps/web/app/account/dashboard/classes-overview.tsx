"use client";

import type { TeacherClass } from "@sbi/contracts";
import { Button } from "@sbi/ui";
import Link from "next/link";
import { useState } from "react";
import { useErrorText } from "../../i18n/error-text";
import { useT } from "../../i18n/provider";
import { CodePanel, CreateClass, type ShownCode } from "../../teach/teach-home";
import { classHref } from "../../teach/class-card";
import { LatestWeek } from "../../teach/class-summary";
import { useClasses } from "../../teach/use-classes";

function ClassRow({ item }: { item: TeacherClass }) {
  const t = useT("teach");
  return (
    <li className="account-classes__row">
      <Link className="account-classes__name" href={classHref(item.classId, "lessons")}>
        {item.name}
      </Link>
      <span className="account-classes__meta">
        <span>{t("codeHint", { hint: item.codeHint })}</span>
        <span>
          {item.lessons.length === 1
            ? t("dashLessonOne")
            : t("dashLessonOther", { count: item.lessons.length })}
        </span>
        <LatestWeek classId={item.classId} />
      </span>
    </li>
  );
}

/** Classes at a glance; every control stays on /teach so there is one place to change them. */
export function ClassesOverview() {
  const t = useT("teach");
  const errorText = useErrorText();
  const classes = useClasses(true);
  const [creating, setCreating] = useState(false);
  const [shown, setShown] = useState<ShownCode>();
  const open = classes.data?.classes.filter((item) => !item.archivedAt) ?? [];

  return (
    <>
      {shown ? <CodePanel shown={shown} onDone={() => setShown(undefined)} /> : null}
      <section className="account-card account-classes" aria-labelledby="account-classes">
        <div className="account-classes__head">
          <h2 id="account-classes">{t("accountCardLink")}</h2>
          <Button
            variant="quiet"
            size="small"
            aria-expanded={creating}
            onClick={() => setCreating(!creating)}
          >
            {t("dashNewClass")}
          </Button>
        </div>
        {classes.isPending ? (
          <p role="status">{t("checking")}</p>
        ) : classes.error ? (
          <p role="alert">{errorText(classes.error.message)}</p>
        ) : open.length === 0 ? (
          <p>{t("noClasses")}</p>
        ) : (
          <ul className="account-classes__list">
            {open.map((item) => (
              <ClassRow key={item.classId} item={item} />
            ))}
          </ul>
        )}
        <Link href="/teach" className="account-card__row">
          {t("dashManage")}
        </Link>
      </section>
      {creating ? (
        <CreateClass
          onCreated={(created) => {
            setCreating(false);
            setShown(created);
          }}
        />
      ) : null}
    </>
  );
}
