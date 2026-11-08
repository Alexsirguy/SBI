"use client";

import { Button, SelectField } from "@sbi/ui";
import Link from "next/link";
import { useState } from "react";
import { useAccount } from "../account/use-account";
import { useSaveLesson, useSavedLessons } from "../account/use-saved-lessons";
import { useT } from "../i18n/provider";
import { useErrorText } from "../lesson/lesson-t";
import { useClasses, useClassMutation } from "./use-classes";

/** Puts the lesson on screen into one of the teacher's classes, saving it first if needed (#397). */
export function AddToClass({ lessonId, version }: { lessonId: string; version: number }) {
  const t = useT("teach");
  const errorText = useErrorText();
  const account = useAccount();
  const signedIn = !!account.data;
  const classes = useClasses(signedIn);
  const saved = useSavedLessons(signedIn);
  const save = useSaveLesson();
  const add = useClassMutation("addClassLesson");
  const open = (classes.data?.classes ?? []).filter((item) => !item.archivedAt);
  const [chosen, setChosen] = useState<string>();
  const [added, setAdded] = useState<string>();

  // Learners who aren't teaching, or have no class yet, see nothing new.
  if (!classes.data?.educator || open.length === 0) return null;
  const target = open.find((item) => item.classId === chosen) ?? open[0];
  if (!target) return null;
  const inTarget = target.lessons.some(
    (lesson) => lesson.lessonId === lessonId && lesson.version === version,
  );
  const busy = save.isPending || add.isPending || saved.isPending;

  const submit = async () => {
    setAdded(undefined);
    // The class takes the saved version, so the version on screen is saved first.
    const entry = saved.data?.find((item) => item.lessonId === lessonId);
    if (entry?.version !== version) await save.mutateAsync({ lessonId, version });
    await add.mutateAsync({ classId: target.classId, lessonId });
    setAdded(target.name);
  };

  return (
    <div className="add-to-class">
      {open.length > 1 ? (
        <SelectField
          label={t("addToClassLabel")}
          value={target.classId}
          onChange={(event) => {
            setChosen(event.currentTarget.value);
            setAdded(undefined);
          }}
        >
          {open.map((item) => (
            <option key={item.classId} value={item.classId}>
              {item.name}
            </option>
          ))}
        </SelectField>
      ) : null}
      {inTarget && !added ? (
        <p className="account-card__hint">{t("alreadyIn", { name: target.name })}</p>
      ) : (
        <Button
          variant="quiet"
          size="small"
          disabled={busy}
          onClick={() => void submit().catch(() => undefined)}
        >
          {open.length > 1 ? t("addToClass") : t("addToNamed", { name: target.name })}
        </Button>
      )}
      {added ? (
        <p role="status">
          {t("addedTo", { name: added })} <Link href="/teach">{t("seeClasses")}</Link>
        </p>
      ) : null}
      {save.error || add.error ? (
        <p role="alert">{errorText((save.error ?? add.error)?.message)}</p>
      ) : null}
    </div>
  );
}
