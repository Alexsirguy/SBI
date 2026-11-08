// @vitest-environment happy-dom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CurriculumLinks } from "./curriculum-links";
import { readCurriculum } from "./curriculum-pref";
import { mount, text } from "./dom-test";

const KEY = "sbi.curriculum";

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
    await vi.waitFor(() => expect(codes(container)).toContain("MS-PS4-2"));
    expect(codes(container).some((code) => code?.startsWith("NG-"))).toBe(false);

    await choose(curriculum, "ng");
    await vi.waitFor(() =>
      expect(codes(container)).toContain("NG-PHY-SSS2-WAVES-LIGHT-REFRACTION"),
    );
    expect(codes(container)).not.toContain("MS-PS4-2");
    expect(readCurriculum()).toEqual({ curriculum: "ng" });
  });

  it("filters by level", async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ curriculum: "ng", level: "SSS2" }));
    const { container } = await mount(<CurriculumLinks concepts={["refraction"]} />);
    await vi.waitFor(() =>
      expect(codes(container)).toEqual(["NG-PHY-SSS2-WAVES-LIGHT-REFRACTION"]),
    );
    const level = select(container, 1);
    expect(level.value).toBe("SSS2");

    await choose(level, "");
    await vi.waitFor(() => expect(codes(container).length).toBeGreaterThan(1));
  });

  it("says so when nothing matches", async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ curriculum: "us" }));
    const { container } = await mount(<CurriculumLinks concepts={["poetry"]} />);
    await vi.waitFor(() => expect(text(container)).toContain("No standards"));
  });

  it("ignores a stored value it doesn't know", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ curriculum: "fr", level: "x" }));
    expect(readCurriculum()).toEqual({ curriculum: "none" });
  });
});
