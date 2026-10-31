import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { citationIndex, SourceList } from "./citations";
import { SectionView } from "./modules/section-view";
import { SAMPLE_LESSON, SAMPLE_SOURCES } from "./sample-lesson";

const index = citationIndex(SAMPLE_LESSON, SAMPLE_SOURCES);
describe("citationIndex", () => {
  it("numbers sources in the order the lesson first cites them", () => {
    // The first section cites the magnifier page (A); refraction (both) comes later.
    expect([...index.numbers.values()]).toEqual([1, 2]);
    expect(index.numbers.get(SAMPLE_SOURCES.sources[1]?.sourceId ?? "")).toBe(1);
  });
});

describe("lesson sections", () => {
  it("carry no source markers or claim notes; sources are listed once, at the end", () => {
    for (const section of SAMPLE_LESSON.sections) {
      const html = renderToStaticMarkup(<SectionView section={section} lesson={SAMPLE_LESSON} />);
      expect(html).not.toContain("citation-marker");
      expect(html).not.toContain("Sources:");
    }
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
