import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CitationProvider, citationIndex, SourceList } from "./citations";
import { SectionView } from "./modules/section-view";
import { SAMPLE_LESSON, SAMPLE_SOURCES } from "./sample-lesson";

const index = citationIndex(SAMPLE_LESSON, SAMPLE_SOURCES);
const render = (module: string) => {
  const section = SAMPLE_LESSON.sections.find((item) => item.module === module);
  if (!section) throw new Error(`no ${module}`);
  return renderToStaticMarkup(
    <CitationProvider value={index}>
      <SectionView section={section} lesson={SAMPLE_LESSON} />
    </CitationProvider>,
  );
};

describe("citationIndex", () => {
  it("numbers sources in the order the lesson first cites them", () => {
    // The first section cites the magnifier page (A); refraction (both) comes later.
    expect([...index.numbers.values()]).toEqual([1, 2]);
    expect(index.numbers.get(SAMPLE_SOURCES.sources[1]?.sourceId ?? "")).toBe(1);
  });
});

describe("SectionCitations", () => {
  it("links each cited source and names a claim resting on limited evidence", () => {
    const html = render("what-youre-seeing");
    expect(html).toContain('href="#source-1"');
    expect(html).toContain('aria-label="Source 1: 2.8: The Simple Magnifier"');
    expect(html).toContain("Based on limited evidence:");
  });

  it("says when sources disagree", () => {
    expect(render("how-parts-work")).toContain("Sources disagree:");
  });

  it("adds no per-section label for model knowledge, which the lesson notice covers", () => {
    const html = render("history");
    expect(html).not.toContain("section-citations");
  });

  it("renders nothing extra without a citation index", () => {
    const section = SAMPLE_LESSON.sections[0];
    if (!section) throw new Error("no section");
    expect(
      renderToStaticMarkup(<SectionView section={section} lesson={SAMPLE_LESSON} />),
    ).not.toContain("section-citations");
  });
});

describe("SourceList", () => {
  it("lists sources in marker order with credits, licence links and only allowed quotes", () => {
    const html = renderToStaticMarkup(
      <SourceList sources={SAMPLE_SOURCES} lesson={SAMPLE_LESSON} />,
    );
    expect(html.indexOf('id="source-1"')).toBeLessThan(html.indexOf('id="source-2"'));
    expect(html.indexOf("The Simple Magnifier")).toBeLessThan(html.indexOf("B27: Refraction"));
    expect(html).toContain("Refraction bends light passing into glass.");
    expect(html).toContain('href="https://creativecommons.org/licenses/by/4.0/"');
    expect(html).toContain('<time dateTime="2026-10-30T09:00:00.000Z">30 October 2026</time>');
    expect(html).toContain("sources last checked");
  });
});
