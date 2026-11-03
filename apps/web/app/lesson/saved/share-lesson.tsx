"use client";

import { Button } from "@sbi/ui";
import { useT } from "../../i18n/provider";
import { useErrorText } from "../lesson-t";
import { useSavedLessons, useShareLesson } from "../../account/use-saved-lessons";

/** Asked per lesson, when it would happen: what is shared, what is not, and who checks it first. */
export function ShareLesson({ lessonId }: { lessonId: string }) {
  const t = useT("lesson");
  const errorText = useErrorText();
  const saved = useSavedLessons(true);
  const share = useShareLesson();
  const sharedAt = saved.data?.find((item) => item.lessonId === lessonId)?.sharedAt;

  return (
    <section aria-labelledby="share-heading" className="share-lesson">
      <h2 id="share-heading">{t("shareHeading")}</h2>
      {sharedAt ? (
        <p role="status">{t("sharedStatus")}</p>
      ) : (
        <>
          <p>{t("shareExplain")}</p>
          <Button
            variant="quiet"
            disabled={share.isPending || saved.isPending}
            onClick={() => share.mutate(lessonId)}
          >
            {share.isPending ? t("sharing") : t("shareThisLesson")}
          </Button>
          {share.error ? <p role="alert">{errorText(share.error.message)}</p> : null}
        </>
      )}
    </section>
  );
}
