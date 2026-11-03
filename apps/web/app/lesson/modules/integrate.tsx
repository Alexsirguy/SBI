"use client";

import type { LessonSection } from "@sbi/contracts";
import { Button, TextArea } from "@sbi/ui";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { useT } from "../../i18n/provider";
import { SectionFrame } from "./frame";

async function shareLesson(title: string): Promise<"" | "linkCopied" | "linkCopyFailed"> {
  const url = window.location.href;
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return "";
    } catch (error) {
      // Closing the share sheet is a choice, not a failure worth announcing.
      if ((error as Error).name === "AbortError") return "";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "linkCopied";
  } catch {
    return "linkCopyFailed";
  }
}

/** Merrill's integration: carry the idea into the learner's own life, and pass it on. */
export function IntegrateSection({
  section,
  title,
  askQuestion,
}: {
  section: LessonSection;
  title: string;
  askQuestion?: ReactNode;
}) {
  const t = useT("lesson");
  const [shared, setShared] = useState<"" | "linkCopied" | "linkCopyFailed">("");
  return (
    <SectionFrame section={section}>
      <p>{section.text}</p>
      <TextArea label={t("whereElse")} rows={3} hint={t("noScoreHint")} />
      <div className="share">
        <Button variant="quiet" onClick={() => void shareLesson(title).then(setShared)}>
          {t("shareThisLesson")}
        </Button>
        <p role="status" className="share__status">
          {shared ? t(shared) : ""}
        </p>
      </div>
      <h3>{t("nextSteps")}</h3>
      <ul>
        <li>
          <a href="#section-demonstrate">{t("backToDemonstration")}</a>
        </li>
        <li>
          <Link href="/capture">{t("exploreAnother")}</Link>
        </li>
      </ul>
      {askQuestion}
    </SectionFrame>
  );
}
