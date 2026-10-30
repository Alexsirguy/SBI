import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SAMPLE_LESSON } from "../sample-lesson";
import { CheckThinkingSection } from "./check-thinking";
import { GoFurtherSection } from "./go-further";
import { HistorySection } from "./history";
import { SectionView } from "./section-view";
import { TryAnIdeaSection } from "./try-an-idea";

const section = (module: string) => {
  const found = SAMPLE_LESSON.sections.find((item) => item.module === module);
  if (!found) throw new Error(`sample lesson has no ${module}`);
  return found;
};

describe("TryAnIdeaSection", () => {
  it("invites trying it on ordinary topics and keeps a slot for interactive visuals", () => {
    const html = renderToStaticMarkup(
      <TryAnIdeaSection section={section("try-an-idea")} highRisk={false} />,
    );
    expect(html).toContain("Try it or picture it");
    expect(html).toContain('data-slot="interaction"');
  });

  it("is only ever a thought experiment on a high-risk topic", () => {
    const html = renderToStaticMarkup(
      <TryAnIdeaSection section={section("try-an-idea")} highRisk />,
    );
    expect(html).toContain("Thought experiment: imagine it, do not try it.");
    expect(html).not.toContain("Try it or picture it");
  });
});

describe("HistorySection", () => {
  it("is shown even when its only claim comes from model knowledge (ADR 0011)", () => {
    const history = section("history");
    const claims = SAMPLE_LESSON.claims.filter((claim) => history.claimIds.includes(claim.claimId));
    expect(claims.every((claim) => claim.origin === "model")).toBe(true);
    expect(renderToStaticMarkup(<HistorySection section={history} />)).toContain("Reading stones");
  });
});

describe("CheckThinkingSection", () => {
  it("asks the question with no score, timer or answer shown up front", () => {
    const html = renderToStaticMarkup(
      <CheckThinkingSection
        section={section("check-thinking")}
        explanation="The lens makes a larger image."
        misconceptions={["The object itself does not grow."]}
      />,
    );
    expect(html).toContain("Does the word grow?");
    expect(html).toContain("There is no score and no timer.");
    expect(html).not.toContain("The lens makes a larger image.");
    expect(html).not.toMatch(/score:|points|seconds left|streak/i);
  });
});

describe("GoFurtherSection", () => {
  it("offers next steps within and beyond the lesson", () => {
    const html = renderToStaticMarkup(<GoFurtherSection section={section("go-further")} />);
    expect(html).toContain('href="#section-first-principles"');
    expect(html).toContain('href="/capture"');
  });
});

describe("SectionView for modules 5-8", () => {
  it("passes the lesson's safety class to try-an-idea", () => {
    const html = renderToStaticMarkup(
      <SectionView
        section={section("try-an-idea")}
        lesson={{ ...SAMPLE_LESSON, safetyClass: "high" }}
      />,
    );
    expect(html).toContain("Thought experiment");
  });
});
