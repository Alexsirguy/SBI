"use client";

import { Button } from "@sbi/ui";
import Link from "next/link";
import { useAccount } from "../account/use-account";
import { useRemoveSavedLesson, useSaveLesson, useSavedLessons } from "../account/use-saved-lessons";

/** Saves the version on screen; signed-out learners are offered sign-in and brought back here. */
export function SaveLesson({
  lessonId,
  version,
  returnTo,
}: {
  lessonId: string;
  version: number;
  /** This lesson's own address, so sign-in can bring the learner back to it. */
  returnTo: string;
}) {
  const account = useAccount();
  const signedIn = !!account.data;
  const saved = useSavedLessons(signedIn);
  const save = useSaveLesson();
  const remove = useRemoveSavedLesson();

  if (account.isPending) return null;
  if (!signedIn) {
    return (
      <Link href={`/account/sign-in?next=${encodeURIComponent(returnTo)}`} className="save-lesson">
        Sign in to save this lesson
      </Link>
    );
  }
  const entry = saved.data?.find((item) => item.lessonId === lessonId);
  const thisVersion = entry?.version === version;
  const busy = save.isPending || remove.isPending || saved.isPending;
  return (
    <div className="save-lesson">
      {thisVersion ? (
        <Button
          variant="quiet"
          size="small"
          aria-pressed
          disabled={busy}
          onClick={() => remove.mutate(lessonId)}
        >
          Saved
          <span className="sbi-visually-hidden">, press to remove from saved lessons</span>
        </Button>
      ) : (
        <Button
          variant="quiet"
          size="small"
          aria-pressed={false}
          disabled={busy}
          onClick={() => save.mutate({ lessonId, version })}
        >
          {entry ? "Save this version" : "Save lesson"}
        </Button>
      )}
      <span role="status" className="save-lesson__status">
        {save.isSuccess && thisVersion ? "Saved to your account." : null}
        {remove.isSuccess && !entry ? "Removed from saved lessons." : null}
      </span>
      {save.error || remove.error ? (
        <span role="alert">{(save.error ?? remove.error)?.message}</span>
      ) : null}
    </div>
  );
}
