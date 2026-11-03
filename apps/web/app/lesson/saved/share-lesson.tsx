"use client";

import { Button } from "@sbi/ui";
import { useSavedLessons, useShareLesson } from "../../account/use-saved-lessons";

/** Asked per lesson, when it would happen: what is shared, what is not, and who checks it first. */
export function ShareLesson({ lessonId }: { lessonId: string }) {
  const saved = useSavedLessons(true);
  const share = useShareLesson();
  const sharedAt = saved.data?.find((item) => item.lessonId === lessonId)?.sharedAt;

  return (
    <section aria-labelledby="share-heading" className="share-lesson">
      <h2 id="share-heading">Share with other learners</h2>
      {sharedAt ? (
        <p role="status">
          Shared. A reviewer checks it before anyone else sees it, and your name is never shown.
        </p>
      ) : (
        <>
          <p>
            Other learners asking something similar could get this lesson once a reviewer has
            checked it. We share a copy of the lesson only: never your name, your photo, or what you
            typed. Email addresses and phone numbers are removed from the text.
          </p>
          <Button
            variant="quiet"
            disabled={share.isPending || saved.isPending}
            onClick={() => share.mutate(lessonId)}
          >
            {share.isPending ? "Sharing…" : "Share this lesson"}
          </Button>
          {share.error ? <p role="alert">{share.error.message}</p> : null}
        </>
      )}
    </section>
  );
}
