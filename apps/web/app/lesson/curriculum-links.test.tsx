// @vitest-environment happy-dom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CurriculumLinks } from "./curriculum-links";
import { readCurriculum } from "./curriculum-pref";
import { mount, text } from "./dom-test";

const api = vi.hoisted(() => vi.fn());
vi.mock("../api", () => ({ api }));

const KEY = "sbi.curriculum";
// The standards load on demand, which can be slow while the whole suite runs in parallel.
const LOADED = { timeout: 5000 };

afterEach(() => {
  document.body.replaceChildren();
  window.localStorage.clear();
});

async function choose(select: HTMLSelectElement, value: string) {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const selects = (root: Element) => [...root.querySelectorAll("select")];
function select(root: Element, index: number): HTMLSelectElement {
  const found = selects(root)[index];
  if (!found) throw new Error(`no select at ${index}`);
  return found;
}
const codes = (root: Element) =>
  [...root.querySelectorAll("li code")].map((code) => code.textContent);

describe("CurriculumLinks", () => {
  it("is off until the learner chooses, and loads nothing", async () => {
    const { container } = await mount(<CurriculumLinks concepts={["refraction"]} />);
    expect(selects(container)).toHaveLength(1);
    expect(codes(container)).toEqual([]);
    expect(text(container)).not.toContain("official");
  });

  it("switches between US and Nigerian standards and remembers the choice on the device", async () => {
    const { container } = await mount(
      <CurriculumLinks concepts={["refraction", "focal length"]} />,
    );
    const curriculum = select(container, 0);

    await choose(curriculum, "us");
    await vi.waitFor(() => expect(codes(container)).toContain("MS-PS4-2"), LOADED);
    expect(codes(container).some((code) => code?.startsWith("NG-"))).toBe(false);

    await choose(curriculum, "ng");
    await vi.waitFor(
      () => expect(codes(container)).toContain("NG-PHY-SSS2-WAVES-LIGHT-REFRACTION"),
      LOADED,
    );
    expect(codes(container)).not.toContain("MS-PS4-2");
    expect(readCurriculum()).toEqual({ curriculum: "ng" });
  });

  it("filters by level", async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ curriculum: "ng", level: "SSS2" }));
    const { container } = await mount(<CurriculumLinks concepts={["refraction"]} />);
    await vi.waitFor(
      () => expect(codes(container)).toEqual(["NG-PHY-SSS2-WAVES-LIGHT-REFRACTION"]),
      LOADED,
    );
    const level = select(container, 1);
    expect(level.value).toBe("SSS2");

    await choose(level, "");
    await vi.waitFor(() => expect(codes(container).length).toBeGreaterThan(1), LOADED);
  });

  it("says so when nothing matches", async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ curriculum: "us" }));
    const { container } = await mount(<CurriculumLinks concepts={["poetry"]} />);
    await vi.waitFor(() => expect(text(container)).toContain("No standards"), LOADED);
  });

  it("ignores a stored value it doesn't know", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ curriculum: "fr", level: "x" }));
    expect(readCurriculum()).toEqual({ curriculum: "none" });
  });

  it("lists the topic a lesson was made for first, marked, without repeating it", async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ curriculum: "ng" }));
    const topic = {
      code: "NG-PHY-SSS2-WAVES-LIGHT-REFRACTION",
      concepts: ["refraction"],
      curriculum: "ng",
      frameworkId: "nerdc-sss",
      goals: [],
      level: "SSS2",
      retiredAt: null,
      sourceUrl: null,
      subjectId: "ng-physics",
      theme: "Waves",
      title: "Refraction of light",
    };
    api.mockResolvedValue({ links: [{ link: "exact", topic }] });
    const { container } = await mount(
      <CurriculumLinks concepts={["refraction"]} lessonId="0192f1a0-0000-7000-8000-0000000000c1" />,
    );
    await vi.waitFor(() => expect(text(container)).toContain("Made for this topic"), LOADED);
    await vi.waitFor(() => expect(codes(container).length).toBeGreaterThan(1), LOADED);
    expect(codes(container)[0]).toBe(topic.code);
    expect(codes(container).filter((code) => code === topic.code)).toHaveLength(1);
    expect(api).toHaveBeenCalledWith("lessonTopics", {
      lessonId: "0192f1a0-0000-7000-8000-0000000000c1",
    });
  });
});
