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

  it("draws each visual beside the parts step through the frame it is given", () => {
    const visual = {
      visualId: "0192f1a0-0000-7000-8000-0000000000b1",
      kind: "mechanism",
      manifestUri: "/visuals?visualId=0192f1a0-0000-7000-8000-0000000000b1",
      alt: "Lens bending light",
    } as const;
    const html = renderToStaticMarkup(
      <LessonRail
        lesson={SAMPLE_LESSON}
        label="Magnifying glass"
        askQuestion={null}
        visuals={[visual]}
        renderVisual={(item) => <canvas data-visual={item.visualId} />}
      />,
    );
    expect(html).toContain(`data-visual="${visual.visualId}"`);
    expect(html.match(/id="visuals-heading"/g)).toHaveLength(1);
  });

  it("says a picture is being made until the visuals arrive, and shows nothing when there are none", () => {
    const pending = renderToStaticMarkup(
      <LessonRail
        lesson={SAMPLE_LESSON}
        label="Magnifying glass"
        askQuestion={null}
        visuals={undefined}
      />,
    );
    expect(pending).toContain("Making a picture of how it works…");
    const none = renderToStaticMarkup(
      <LessonRail
        lesson={SAMPLE_LESSON}
        label="Magnifying glass"
        askQuestion={null}
        visuals={[]}
      />,
    );
    expect(none).not.toContain("visuals-heading");
  });
});
