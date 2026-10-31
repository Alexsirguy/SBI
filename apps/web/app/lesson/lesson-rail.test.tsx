import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LessonRail } from "./lesson-rail";
import { SAMPLE_LESSON } from "./sample-lesson";

describe("LessonRail", () => {
  it("says the rest is being written while only the step titles are known", () => {
    const html = renderToStaticMarkup(
      <LessonRail label="Magnifying glass" askQuestion={null} visuals={[]} />,
    );
    expect(html).toContain("Writing the rest of your lesson…");
    expect(html.match(/rail__step--ghost/g)).toHaveLength(8);
  });

  it("opens every step at once, so the learner only scrolls", () => {
    const html = renderToStaticMarkup(
      <LessonRail
        lesson={SAMPLE_LESSON}
        label="Magnifying glass"
        askQuestion={null}
        visuals={[]}
      />,
    );
    for (const section of SAMPLE_LESSON.sections) expect(html).toContain(section.heading ?? "");
    expect(html).not.toContain("rail__step--ghost");
    expect(html).not.toContain("Show me why");
  });
});
