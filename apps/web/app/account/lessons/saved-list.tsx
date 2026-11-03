"use client";

import { Button } from "@sbi/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAccount } from "../use-account";
import { useRemoveSavedLesson, useSavedLessons } from "../use-saved-lessons";

const DATE = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export function SavedList() {
  const router = useRouter();
  const account = useAccount();
  const saved = useSavedLessons(!!account.data);
  const remove = useRemoveSavedLesson();

  useEffect(() => {
    if (account.data === null) router.replace("/account/sign-in?next=%2Faccount%2Flessons");
  }, [account.data, router]);

  if (!account.data || saved.isPending) return <p role="status">Loading your saved lessons…</p>;
  if (saved.error) return <p role="alert">{saved.error.message}</p>;
  if (saved.data.length === 0) {
    return (
      <p>
        Nothing saved yet. Open any lesson and press <strong>Save lesson</strong> to keep it here.{" "}
        <Link href="/capture">Start a lesson</Link>
      </p>
    );
  }
  return (
    <>
      <ul className="saved-list">
        {saved.data.map((item) => (
          <li key={item.lessonId}>
            <Link href={`/lesson/saved?id=${item.lessonId}`}>{item.title}</Link>
            <span className="saved-list__date">Saved {DATE.format(new Date(item.savedAt))}</span>
            <Button
              variant="quiet"
              size="small"
              disabled={remove.isPending}
              onClick={() => remove.mutate(item.lessonId)}
            >
              Remove<span className="sbi-visually-hidden"> {item.title}</span>
            </Button>
          </li>
        ))}
      </ul>
      <div role="status">{remove.isSuccess ? <p>Removed.</p> : null}</div>
      {remove.error ? <p role="alert">{remove.error.message}</p> : null}
    </>
  );
}
