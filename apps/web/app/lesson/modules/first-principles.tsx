import type { Lesson, LessonSection } from "@sbi/contracts";
import { SectionFrame } from "./frame";
import { conceptsInOrder } from "./order";

type Concept = Lesson["concepts"][number];

/** Module 3: the explanation, then the key ideas in the order they build on each other. */
export function FirstPrinciplesSection({
  section,
  concepts,
}: {
  section: LessonSection;
  concepts: Concept[];
}) {
  const ordered = conceptsInOrder(concepts);
  const labels = new Map(concepts.map((concept) => [concept.conceptId, concept.label]));
  return (
    <SectionFrame section={section} evidence="inference">
      <p>{section.text}</p>
      {ordered.length > 0 ? (
        <>
          <h3>Key ideas, in order</h3>
          <ol className="concepts">
            {ordered.map((concept) => {
              const builds = concept.prerequisites.flatMap((id) => labels.get(id) ?? []);
              return (
                <li key={concept.conceptId}>
                  {concept.label}
                  {builds.length > 0 ? (
                    <span className="builds-on"> (builds on {builds.join(", ")})</span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </>
      ) : null}
    </SectionFrame>
  );
}
