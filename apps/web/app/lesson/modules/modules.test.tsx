import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SAMPLE_LESSON } from "../sample-lesson";
import { FirstPrinciplesSection } from "./first-principles";
import { HowPartsWorkSection } from "./how-parts-work";
import { SectionView } from "./section-view";
import { SeeingSection } from "./seeing";
import { ShortAnswerSection } from "./short-answer";

const section = (module: string) => {
  const found = SAMPLE_LESSON.sections.find((item) => item.module === module);
  if (!found) throw new Error(`sample lesson has no ${module}`);
  return found;
};

describe("SeeingSection", () => {
  it("labels its text as an observation, in words and not only by style", () => {
    const html = renderToStaticMarkup(<SeeingSection section={section("what-youre-seeing")} />);
    expect(html).toContain("What you can observe");
    expect(html).toContain('class="lesson-section evidence-observation"');
    expect(html).toContain('id="section-what-youre-seeing"');
    expect(html).toContain("Small print looks larger");
  });
});

describe("ShortAnswerSection", () => {
  it("states the answer as an explanation, in bold", () => {
    const html = renderToStaticMarkup(<ShortAnswerSection section={section("short-answer")} />);
    expect(html).toContain("Explanation");
    expect(html).toContain("<strong>The lens makes a larger, upright image");
  });
});

describe("FirstPrinciplesSection", () => {
  it("lists the key ideas with prerequisites first and says what each builds on", () => {
    const html = renderToStaticMarkup(
      <FirstPrinciplesSection
        section={section("first-principles")}
        concepts={SAMPLE_LESSON.concepts}
      />,
    );
    const refraction = html.indexOf("<li>refraction");
    expect(refraction).toBeGreaterThan(-1);
    expect(refraction).toBeLessThan(html.indexOf("<li>angular magnification"));
    expect(html).toContain("(builds on refraction)");
  });

  it("leaves out the key ideas list when the lesson names no concepts", () => {
    const html = renderToStaticMarkup(
      <FirstPrinciplesSection section={section("first-principles")} concepts={[]} />,
    );
    expect(html).not.toContain("Key ideas");
  });
});

describe("HowPartsWorkSection", () => {
  it("shows a multi-sentence explanation as numbered cause-and-effect steps", () => {
    const html = renderToStaticMarkup(
      <HowPartsWorkSection
        section={{
          ...section("how-parts-work"),
          text: "The lens bends light. Your eye sees a wider angle.",
        }}
      />,
    );
    expect(html).toContain(
      '<ol class="causal-steps"><li>The lens bends light.</li><li>Your eye sees a wider angle.</li></ol>',
    );
  });

  it("keeps a one-sentence explanation as a paragraph", () => {
    const html = renderToStaticMarkup(<HowPartsWorkSection section={section("how-parts-work")} />);
    expect(html).not.toContain("causal-steps");
  });
});

describe("SectionView", () => {
  it("gives every module its anchor and heading", () => {
    for (const item of SAMPLE_LESSON.sections) {
      const html = renderToStaticMarkup(<SectionView section={item} lesson={SAMPLE_LESSON} />);
      expect(html).toContain(`id="section-${item.module}"`);
      expect(html).toContain(item.heading ?? "");
    }
  });
});
