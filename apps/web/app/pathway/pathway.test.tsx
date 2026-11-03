// @vitest-environment happy-dom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { button, click, mount, text } from "../lesson/dom-test";

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const { GrownUpGate } = await import("./grown-up-gate");
const { pathwayAge } = await import("./pathway");
const { PathwayProvider } = await import("./provider");
const { WhoIsLearning } = await import("./who-is-learning");
const { DepthControls } = await import("../lesson/depth-controls");

afterEach(() => {
  document.body.replaceChildren();
  document.cookie = "sbi_pathway=; Max-Age=0; Path=/";
  router.refresh.mockReset();
  vi.restoreAllMocks();
});

async function answer(scope: Element, value: string) {
  const input = scope.querySelector<HTMLInputElement>(".grown-up-gate input");
  if (!input) throw new Error("no gate");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click(button(scope, "Check"));
}

describe("pathwayAge", () => {
  it("holds the child band in the child pathway, whatever was asked", () => {
    expect(pathwayAge("child", "adult")).toBe("child");
    expect(pathwayAge("child", "none")).toBe("child");
    expect(pathwayAge("self", "adult")).toBe("adult");
    expect(pathwayAge(undefined, "teen")).toBe("teen");
  });
});

describe("GrownUpGate", () => {
  it("passes only on the right answer, with a new question after a wrong one", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // 6 × 6
    const onPass = vi.fn();
    const { container } = await mount(
      <GrownUpGate reason="Why" onPass={onPass} onCancel={vi.fn()} />,
    );
    expect(text(container)).toContain("What is 6 × 6?");

    await answer(container, "35");
    expect(onPass).not.toHaveBeenCalled();
    expect(text(container)).toContain("Ask a grown-up to help.");

    await answer(container, "36");
    expect(onPass).toHaveBeenCalledTimes(1);
  });
});

describe("WhoIsLearning", () => {
  it("is chosen, never guessed, and remembered in a cookie", async () => {
    const { container } = await mount(
      <PathwayProvider initial={undefined}>
        <WhoIsLearning />
      </PathwayProvider>,
    );
    expect(text(container)).toContain("We never guess anyone's age.");

    await click(button(container, "A child is learning"));

    expect(document.cookie).toContain("sbi_pathway=child");
    expect(text(container)).toContain("Lessons are set for a child.");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("leaves the child pathway only after a grown-up check", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { container } = await mount(
      <PathwayProvider initial="child">
        <WhoIsLearning />
      </PathwayProvider>,
    );

    await click(button(container, "I'm learning for myself"));
    expect(text(container)).toContain("Ask a grown-up");
    expect(document.cookie).not.toContain("sbi_pathway=self");

    await answer(container, "36");
    expect(document.cookie).toContain("sbi_pathway=self");
  });
});

describe("DepthControls in the child pathway", () => {
  it("locks the age band behind the grown-up check", async () => {
    const onChange = vi.fn();
    const { container } = await mount(
      <PathwayProvider initial="child">
        <DepthControls prefs={{ age: "child", depth: "explore" }} onChange={onChange} />
      </PathwayProvider>,
    );

    expect(container.querySelector("select")).toBeNull();
    expect(text(container)).toContain("Set for a child.");
    await click(button(container, "Change (ask a grown-up)"));
    expect(text(container)).toContain("What is");
  });

  it("leaves the age band free for someone learning for themselves", async () => {
    const { container } = await mount(
      <PathwayProvider initial="self">
        <DepthControls prefs={{ age: "none", depth: "explore" }} onChange={vi.fn()} />
      </PathwayProvider>,
    );
    expect(container.querySelector("select")).not.toBeNull();
  });
});
