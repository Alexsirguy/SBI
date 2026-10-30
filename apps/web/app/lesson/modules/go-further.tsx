import type { LessonSection } from "@sbi/contracts";
import Link from "next/link";
import type { ReactNode } from "react";
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
  return (
    <SectionFrame section={section}>
      <p>{section.text}</p>
      <h3>Next steps</h3>
      <ul>
        <li>
          <a href="#section-first-principles">Go back over the key ideas</a>
        </li>
        <li>
          <Link href="/capture">Explore another object</Link>
        </li>
      </ul>
      {askQuestion}
    </SectionFrame>
  );
}
