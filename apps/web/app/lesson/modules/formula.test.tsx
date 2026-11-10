// @vitest-environment happy-dom
import type { Formula } from "@sbi/contracts";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { button, click, find, mount, text } from "../dom-test";
import type { ExperimentController } from "../experiment";
import { PracticeProvider } from "../practice";
import { SAMPLE_MERRILL_LESSON } from "../sample-merrill-lesson";
import { FormulaCard, FormulaPracticeCard, parseAnswer } from "./formula";

const formula: Formula = {
  formulaId: "formula-1",
  name: "Friction",
  expression: "F = μR",
  words: "The rougher the surface or the heavier the load, the bigger the friction.",
  symbols: [
    { symbol: "F", meaning: "friction force", unit: "N", quantityId: "pitch" },
    { symbol: "μ", meaning: "coefficient of friction", unit: "" },
    { symbol: "R", meaning: "normal reaction", unit: "N", quantityId: "tension" },
  ],
  example: {
    problem: "A 200 N carton sits on a floor with μ = 0.3. What is the friction?",
    steps: ["F = μR", "F = 0.3 × 200 N", "F = 60 N"],
    answer: "60 N",
  },
  practice: {
    prompt: "A 500 N box on a floor with μ = 0.4. What is the friction, in N?",
    answer: 200,
    unit: "N",
    tolerance: 1,
    working: ["F = μR", "F = 0.4 × 500 N", "F = 200 N"],
  },
};

function fakeController(): {
  controller: ExperimentController;
  move: (v: number) => Promise<void>;
} {
  const values: Record<string, number> = { tension: 200 };
  const listeners = new Set<() => void>();
  const controller: ExperimentController = {
    visualId: "fake",
    has: ({ controls = [], readouts = [] }) =>
      controls.every((id) => id === "tension") && readouts.every((id) => id === "pitch"),
    set: () => true,
    apply: () => true,
    values: () => ({ ...values }),
    readout: (id) => (id === "pitch" ? 0.3 * (values.tension ?? 0) : undefined),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    highlight: () => true,
    reveal: () => undefined,
  };
  const move = (value: number) =>
    act(async () => {
      values.tension = value;
      listeners.forEach((listener) => listener());
    });
  return { controller, move };
}

async function typeInto(input: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

afterEach(() => document.body.replaceChildren());

describe("FormulaCard", () => {
  it("shows the formula, its letters with units, and the worked example", async () => {
    const { container } = await mount(
      <PracticeProvider experiment={{ status: "none" }}>
        <FormulaCard formula={formula} experiment={SAMPLE_MERRILL_LESSON.experiment} />
      </PracticeProvider>,
    );
    expect(text(find(container, ".formula__expression"))).toBe("F = μR");
    expect(text(find(container, ".formula__symbols"))).toContain(
      "μcoefficient of friction (no unit)",
    );
    expect(text(container)).toContain("Worked example");
    expect(container.querySelectorAll(".formula__steps li")).toHaveLength(3);
    expect(text(container)).toContain("Answer: 60 N");
    expect(container.querySelector(".formula__live")).toBeNull();
  });

  it("fills in the lab's values live, inputs before the result", async () => {
    const { controller, move } = fakeController();
    const { container } = await mount(
      <PracticeProvider experiment={{ status: "ready", controller }}>
        <FormulaCard formula={formula} experiment={SAMPLE_MERRILL_LESSON.experiment} />
      </PracticeProvider>,
    );
    const live = () => [...container.querySelectorAll(".formula__live li")].map(text);
    expect(live()).toEqual(["R = 200 N", "F = 60 N"]);
    await move(100);
    expect(live()).toEqual(["R = 100 N", "F = 30 N"]);
  });
});

describe("FormulaPracticeCard", () => {
  const input = (container: Element) =>
    find(container, "input[inputmode='decimal']") as HTMLInputElement;

  it("asks for a number, coaches a miss, and offers the working", async () => {
    const { container } = await mount(<FormulaPracticeCard formula={formula} />);
    expect(text(container)).toContain("Your answer, in N");
    await typeInto(input(container), "sixty");
    await click(button(container, "Check"));
    expect(text(find(container, '[role="status"]'))).toContain("Type a number");

    await typeInto(input(container), "150");
    await click(button(container, "Check"));
    expect(text(find(container, '[role="status"]'))).toContain("Not yet.");
    expect(container.querySelector(".formula__working")).toBeNull();
    await click(button(container, "Show the working"));
    expect(text(find(container, ".formula__working"))).toContain("F = 0.4 × 500 N");
    expect(text(find(container, ".formula__working"))).toContain("The answer is 200 N.");
  });

  it("counts an answer within the tolerance as right and shows the working", async () => {
    const { container } = await mount(<FormulaPracticeCard formula={formula} />);
    await typeInto(input(container), "200.5");
    await click(button(container, "Check"));
    expect(text(find(container, '[role="status"]'))).toBe("Right.");
    expect(container.querySelector(".formula__working")).not.toBeNull();
  });
});

describe("parseAnswer", () => {
  it("reads either decimal mark and grouped digits, and nothing else", () => {
    expect(parseAnswer("0,25")).toBe(0.25);
    expect(parseAnswer(" 1 500 ")).toBe(1500);
    expect(parseAnswer("-3.5")).toBe(-3.5);
    expect(parseAnswer("2e3")).toBe(2000);
    expect(parseAnswer("60 N")).toBeUndefined();
    expect(parseAnswer("")).toBeUndefined();
  });
});
