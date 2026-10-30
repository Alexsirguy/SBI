import type { LessonSection } from "@sbi/contracts";
import Link from "next/link";
import { SectionFrame } from "./frame";

/** Module 8: where to go next, inside and beyond this lesson. */
export function GoFurtherSection({ section }: { section: LessonSection }) {
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
    </SectionFrame>
  );
}
