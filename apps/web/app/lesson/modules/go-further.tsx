import type { LessonSection } from "@sbi/contracts";
import Link from "next/link";
import type { ReactNode } from "react";
import { useT } from "../../i18n/provider";
import { SectionFrame } from "./frame";

/** Module 8: where to go next, inside and beyond this lesson. */
export function GoFurtherSection({
  section,
  askQuestion,
}: {
  section: LessonSection;
  /** The learner's own next question, so where to go next stays their choice. */
  askQuestion?: ReactNode;
}) {
  const t = useT("lesson");
  return (
    <SectionFrame section={section}>
      <p>{section.text}</p>
      <h3>{t("nextSteps")}</h3>
      <ul>
        <li>
          <a href="#section-first-principles">{t("backToKeyIdeas")}</a>
        </li>
        <li>
          <Link href="/capture">{t("exploreAnother")}</Link>
        </li>
      </ul>
      {askQuestion}
    </SectionFrame>
  );
}
