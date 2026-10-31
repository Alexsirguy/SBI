import type { Lesson, LessonVisuals } from "@sbi/contracts";
import type { ReactNode } from "react";
import { MODULE_LABELS, MODULES } from "./modules/labels";
import { SectionView } from "./modules/section-view";

// Reserved from the start so diagrams arrive without moving the text the learner is reading.
function VisualsSlot({
  visuals,
  renderVisual,
}: {
  /** Undefined while the visual is still being made for this lesson. */
  visuals: LessonVisuals["visuals"] | undefined;
  renderVisual: RenderVisual;
}) {
  if (visuals?.length === 0) return null;
  return (
    <section aria-labelledby="visuals-heading" className="lesson-visuals">
      <h2 id="visuals-heading">See how it works</h2>
      {visuals ? (
        visuals.map((visual) => <div key={visual.visualId}>{renderVisual(visual)}</div>)
      ) : (
        <p role="status" className="lesson-visuals__pending">
          Making a picture of how it works…
        </p>
      )}
    </section>
  );
}

// Passed in, so the rail stays free of the API client and renders in unit tests.
type RenderVisual = (visual: LessonVisuals["visuals"][number]) => ReactNode;

const altOnly: RenderVisual = (visual) => <p>{visual.alt}</p>;

/** The prototype's rail, opened in full so the learner only scrolls (owner decision, #287). */
export function LessonRail({
  lesson,
  label,
  askQuestion,
  visuals,
  renderVisual = altOnly,
}: {
  lesson?: Lesson;
  label: string;
  askQuestion: ReactNode;
  visuals: LessonVisuals["visuals"] | undefined;
  renderVisual?: RenderVisual;
}) {
  if (!lesson) {
    return (
      <div className="rail-pending">
        <p className="rail-pending__note">Writing the rest of your lesson…</p>
        <ol className="rail" aria-hidden="true">
          {MODULES.map((module) => (
            <li key={module} className="rail__step rail__step--ghost">
              {MODULE_LABELS[module]}
            </li>
          ))}
        </ol>
      </div>
    );
  }
  return (
    <ol className="rail" aria-label="Lesson steps">
      {lesson.sections.map((section) => (
        <li
          key={section.sectionId}
          className={`rail__step${section.module === "short-answer" ? " rail__step--answer" : ""}`}
        >
          <SectionView
            section={section}
            lesson={lesson}
            objectLabel={label}
            askQuestion={askQuestion}
          />
          {/* Pictures sit beside the mechanism they show, after the text (#83). */}
          {section.module === "how-parts-work" ? (
            <VisualsSlot visuals={visuals} renderVisual={renderVisual} />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
