import { isMerrillLesson, type Lesson, type LessonVisuals } from "@sbi/contracts";
import type { ReactNode } from "react";
import { useT } from "../i18n/provider";
import { MODULE_LABEL_KEYS, MODULES } from "./modules/labels";
import { SectionView } from "./modules/section-view";

// Reserved from the start so diagrams arrive without moving the text the learner is reading.
function VisualsSlot({
  visuals,
  renderVisual,
  experiment = false,
}: {
  /** Undefined while the visual is still being made for this lesson. */
  visuals: LessonVisuals["visuals"] | undefined;
  renderVisual: RenderVisual;
  /** A Merrill lesson's visual is the experiment its steps and challenges drive. */
  experiment?: boolean;
}) {
  const t = useT("lesson");
  if (visuals?.length === 0) return null;
  return (
    <section
      aria-labelledby="visuals-heading"
      className={`lesson-visuals${experiment ? " lesson-visuals--experiment" : ""}`}
    >
      <h2 id="visuals-heading">{experiment ? t("theExperiment") : t("seeHowItWorks")}</h2>
      {visuals ? (
        visuals.map((visual) => (
          <div key={visual.visualId} data-visual-id={visual.visualId}>
            {renderVisual(visual)}
          </div>
        ))
      ) : (
        <p role="status" className="lesson-visuals__pending">
          {experiment ? t("settingUpExperiment") : t("makingPicture")}
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
  const t = useT("lesson");
  if (!lesson) {
    return (
      <div className="rail-pending">
        <p className="rail-pending__note">{t("writingRest")}</p>
        <ol className="rail" aria-hidden="true">
          {MODULES.map((module) => (
            <li key={module} className="rail__step rail__step--ghost">
              {t(MODULE_LABEL_KEYS[module])}
            </li>
          ))}
        </ol>
      </div>
    );
  }
  const merrill = isMerrillLesson(lesson);
  const slot = <VisualsSlot visuals={visuals} renderVisual={renderVisual} experiment={merrill} />;
  return (
    <ol className="rail" aria-label={t("lessonSteps")}>
      {lesson.sections.map((section) => (
        <li
          key={section.sectionId}
          data-section-id={section.sectionId}
          className={`rail__step${section.module === "short-answer" ? " rail__step--answer" : ""}`}
        >
          <SectionView
            section={section}
            lesson={lesson}
            objectLabel={label}
            askQuestion={askQuestion}
            pictures={section.module === "demonstrate" ? slot : undefined}
          />
          {/* Pictures sit beside the mechanism they show, after the text (#83). */}
          {!merrill && section.module === "how-parts-work" ? slot : null}
        </li>
      ))}
    </ol>
  );
}
