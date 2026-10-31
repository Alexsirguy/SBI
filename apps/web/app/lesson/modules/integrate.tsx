"use client";

import type { LessonSection } from "@sbi/contracts";
import { Button, TextArea } from "@sbi/ui";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { SectionFrame } from "./frame";

async function shareLesson(title: string): Promise<string> {
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
    return "Link copied. Paste it to share this lesson.";
  } catch {
    return "Could not copy the link. Copy it from the address bar instead.";
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
  const [shared, setShared] = useState("");
  return (
    <SectionFrame section={section}>
      <p>{section.text}</p>
      <TextArea
        label="Where else could you use this? (optional, not saved)"
        rows={3}
        hint="Take your time. There is no score and no timer."
      />
      <div className="share">
        <Button variant="quiet" onClick={() => void shareLesson(title).then(setShared)}>
          Share this lesson
        </Button>
        <p role="status" className="share__status">
          {shared}
        </p>
      </div>
      <h3>Next steps</h3>
      <ul>
        <li>
          <a href="#section-demonstrate">Go back over the demonstration</a>
        </li>
        <li>
          <Link href="/capture">Explore another object</Link>
        </li>
      </ul>
      {askQuestion}
    </SectionFrame>
  );
}
