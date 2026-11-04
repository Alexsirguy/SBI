// @vitest-environment happy-dom
import type { ControlSetting } from "@sbi/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { button, click, find, mount, radio, text } from "../dom-test";
import type { ExperimentController } from "../experiment";
import { LessonRail } from "../lesson-rail";
import { type ExperimentState, PracticeProvider } from "../practice";
import { SAMPLE_MERRILL_LESSON, SAMPLE_MERRILL_VISUALS } from "../sample-merrill-lesson";
import { ActivateSection } from "./activate";
import { ApplySection } from "./apply";
import { DemonstrateSection } from "./demonstrate";
import { IntegrateSection } from "./integrate";
import { SectionView } from "./section-view";

const lesson = SAMPLE_MERRILL_LESSON;
const section = (module: string) => {
  const found = lesson.sections.find((item) => item.module === module);
  if (!found) throw new Error(`sample lesson has no ${module}`);
  return found;
};
const guess = lesson.tasks.find((task) => task.module === "activate");
const challenges = lesson.tasks.filter((task) => task.module === "apply");

/** Stands in for the visual: one tension slider and the lesson's pitch formula. */
function fakeExperiment(controls = ["tension"]) {
  const values: Record<string, number> = { tension: 110 };
  const listeners = new Set<() => void>();
  const set = (controlId: string, value: number) => {
    values[controlId] = value;
    listeners.forEach((listener) => listener());
    return true;
  };
  const controller: ExperimentController = {
    visualId: "fake",
    has: ({ controls: wanted = [], readouts = [] }) =>
      wanted.every((id) => controls.includes(id)) && readouts.every((id) => id === "pitch"),
    set,
    apply: (settings: ControlSetting[]) =>
      settings.every((setting) => set(setting.controlId, setting.value)),
    values: () => ({ ...values }),
    readout: (id) => (id === "pitch" ? Math.sqrt((values.tension ?? 0) / 0.003) / 1.3 : undefined),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    highlight: () => true,
    reveal: vi.fn(),
  };
  return {
    controller,
    values,
    move: (value: number) => act(async () => void set("tension", value)),
  };
}

const ready = (controller: ExperimentController): ExperimentState => ({
  status: "ready",
  controller,
});

afterEach(() => document.body.replaceChildren());

describe("Problem", () => {
  it("names the object, states the problem and what the lesson assumes", () => {
    const html = renderToStaticMarkup(
      <SectionView section={section("problem")} lesson={lesson} objectLabel="Guitar" />,
    );
    expect(html).toContain("<strong>Object:</strong> Guitar");
    expect(html).toContain("A string sounds lower than the tuner says.");
    expect(html).toContain("A steel string on a full-size guitar");
  });
});

describe("Activate and the reveal after Demonstrate", () => {
  it("locks a guess without feedback, then compares it once the demonstration is done", async () => {
    if (!guess) throw new Error("no guess");
    const { container } = await mount(
      <PracticeProvider experiment={{ status: "none" }}>
        <ActivateSection section={section("activate")} task={guess} />
        <DemonstrateSection
          section={section("demonstrate")}
          concepts={lesson.concepts}
          guess={guess}
        />
      </PracticeProvider>,
    );
    const activate = container.querySelector("#section-activate");
    if (!activate) throw new Error("no activate section");
    expect(button(activate, "Lock in my guess").disabled).toBe(true);
    await click(radio(activate, "Loosen the string"));
    await click(button(activate, "Lock in my guess"));

    expect(text(activate)).toContain(
      "Your guess: Loosen the string. You will find out after the demonstration.",
    );
    expect(activate.querySelector('[role="status"]')).not.toBeNull();
    expect(text(activate)).not.toContain(guess.feedback[0] ?? "");
    expect(activate.querySelector('input[type="radio"]')).toBeNull();

    const reveal = find(container, ".guess-reveal");
    expect(text(reveal)).toContain("You guessed: Loosen the string.");
    expect(text(reveal)).toContain(guess.feedback[0] ?? "");
    expect(text(reveal)).toContain("The answer: Tighten the string");
    expect(text(reveal)).toContain(guess.feedback[1] ?? "");
  });
});

describe("Demonstrate", () => {
  it("shows numbered steps, the key ideas, and a Show me that plays a step in the experiment", async () => {
    const { controller, values } = fakeExperiment();
    const { container } = await mount(
      <PracticeProvider experiment={ready(controller)}>
        <DemonstrateSection section={section("demonstrate")} concepts={lesson.concepts} />
      </PracticeProvider>,
    );
    expect(container.querySelectorAll(".demo-steps > li")).toHaveLength(3);
    expect(text(container)).toContain("Key ideas, in order");
    // The third step moves nothing, so it has nothing to show.
    expect(container.querySelectorAll(".demo-steps button")).toHaveLength(2);

    await click(button(container, "Show me step 2"));
    expect(values.tension).toBe(160);
    expect(controller.reveal).toHaveBeenCalled();
    expect(text(find(container, '[role="status"]'))).toBe("Step 2 is set in the experiment.");
  });

  it("offers no Show me while there is no experiment to drive", async () => {
    const { container } = await mount(
      <PracticeProvider experiment={{ status: "pending" }}>
        <DemonstrateSection section={section("demonstrate")} concepts={lesson.concepts} />
      </PracticeProvider>,
    );
    expect(container.querySelectorAll(".demo-steps button")).toHaveLength(0);
  });
});

describe("Apply with the experiment", () => {
  it("coaches a miss with the wrong prediction's feedback and a hint, then solves on retry", async () => {
    const { controller, values, move } = fakeExperiment();
    const { container } = await mount(
      <PracticeProvider experiment={ready(controller)}>
        <ApplySection
          section={section("apply")}
          tasks={challenges}
          experiment={lesson.experiment}
        />
      </PracticeProvider>,
    );
    const card = find(container, ".challenge");
    expect(() => button(card, "Set up the experiment")).toThrow();
    await click(radio(card, "Lower the tension"));
    values.tension = 60;
    await click(button(card, "Set up the experiment"));
    expect(values.tension).toBe(110);
    expect(controller.reveal).toHaveBeenCalled();
    expect(text(find(card, ".challenge__value"))).toBe("147.3 Hz");

    await move(160);
    expect(text(find(card, ".challenge__value"))).toBe("177.6 Hz");
    await click(button(card, "Check"));
    const result = find(card, '[role="status"]');
    expect(text(result)).toContain("Not yet.");
    expect(text(result)).toContain("Lowering tension drops the pitch.");
    expect(text(result)).toContain("Pitch is 177.6 Hz; you need at least 180 Hz.");

    await move(170);
    await click(button(card, "Check"));
    expect(text(result)).toContain("Solved.");
    expect(text(result)).toContain("Right: pitch grows with the square root of tension.");
  });

  it("does not repeat a right prediction's feedback when coaching", async () => {
    const { controller } = fakeExperiment();
    const { container } = await mount(
      <PracticeProvider experiment={ready(controller)}>
        <ApplySection
          section={section("apply")}
          tasks={challenges}
          experiment={lesson.experiment}
        />
      </PracticeProvider>,
    );
    const card = find(container, ".challenge");
    await click(radio(card, "Raise the tension"));
    await click(button(card, "Set up the experiment"));
    await click(button(card, "Check"));
    const result = text(find(card, '[role="status"]'));
    expect(result).toContain("Pitch is 147.3 Hz; you need at least 180 Hz.");
    expect(result).not.toContain("Right: pitch grows");
  });
});

describe("Apply without a usable experiment", () => {
  it("is multiple choice: each pick explains itself and a wrong one can be retried", async () => {
    const { container } = await mount(
      <PracticeProvider experiment={{ status: "failed" }}>
        <ApplySection
          section={section("apply")}
          tasks={challenges}
          experiment={lesson.experiment}
        />
      </PracticeProvider>,
    );
    const card = find(container, ".challenge");
    expect(text(card)).not.toContain("Setting up the experiment");
    await click(button(card, "Lower the tension"));
    const result = find(card, '[role="status"]');
    expect(text(result)).toContain("Not quite. Try another.");
    expect(text(result)).toContain("Lowering tension drops the pitch.");
    await click(button(card, "Raise the tension"));
    expect(text(result)).toContain("Solved.");
    expect(text(result)).toContain("Right: pitch grows with the square root of tension.");
    expect(button(card, "Raise the tension").getAttribute("aria-pressed")).toBe("true");
  });

  it("says the experiment is coming while still letting the learner answer", async () => {
    const { container } = await mount(
      <PracticeProvider experiment={{ status: "pending" }}>
        <ApplySection
          section={section("apply")}
          tasks={challenges}
          experiment={lesson.experiment}
        />
      </PracticeProvider>,
    );
    const card = find(container, ".challenge");
    expect(text(card)).toContain("Setting up the experiment…");
    await click(button(card, "Raise the tension"));
    expect(text(card)).toContain("Solved.");
  });

  it("falls back when the visual lacks a control the challenge needs", async () => {
    const { controller } = fakeExperiment(["length"]);
    const { container } = await mount(
      <PracticeProvider experiment={ready(controller)}>
        <ApplySection
          section={section("apply")}
          tasks={challenges}
          experiment={lesson.experiment}
        />
      </PracticeProvider>,
    );
    const card = find(container, ".challenge");
    expect(card.querySelector('input[type="radio"]')).toBeNull();
    expect(button(card, "Raise the tension")).toBeDefined();
  });
});

describe("Integrate", () => {
  it("asks for a reflection that is not saved, and copies the link when sharing is not offered", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const { container } = await mount(
      <IntegrateSection
        section={section("integrate")}
        title={lesson.title}
        askQuestion={<p>ask</p>}
      />,
    );
    expect(text(container)).toContain("Where else could you use this? (optional, not saved)");
    expect(container.querySelector('a[href="/capture"]')).not.toBeNull();
    expect(text(container)).toContain("ask");
    await click(button(container, "Share this lesson"));
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(text(find(container, '[role="status"]'))).toBe(
      "Link copied. Paste it to share this lesson.",
    );
  });

  it("uses the device's share sheet when there is one", async () => {
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    const { container } = await mount(
      <IntegrateSection section={section("integrate")} title={lesson.title} />,
    );
    await click(button(container, "Share this lesson"));
    expect(share).toHaveBeenCalledWith({ title: lesson.title, url: window.location.href });
    Reflect.deleteProperty(navigator, "share");
  });
});

describe("LessonRail for a Merrill lesson", () => {
  it("draws the experiment inside Demonstrate, not after a parts step", () => {
    const html = renderToStaticMarkup(
      <LessonRail
        lesson={lesson}
        label="Guitar"
        askQuestion={null}
        visuals={SAMPLE_MERRILL_VISUALS.visuals}
        renderVisual={(item) => <canvas data-visual={item.visualId} />}
      />,
    );
    const demonstrate = html.slice(
      html.indexOf('id="section-demonstrate"'),
      html.indexOf('id="section-apply"'),
    );
    expect(demonstrate).toContain("data-visual=");
    expect(demonstrate).toContain("The experiment");
    expect(demonstrate.indexOf("data-visual=")).toBeLessThan(demonstrate.indexOf("Key ideas"));
    expect(html.match(/id="visuals-heading"/g)).toHaveLength(1);
  });

  it("says the experiment is being set up until the visuals arrive", () => {
    const html = renderToStaticMarkup(
      <LessonRail lesson={lesson} label="Guitar" askQuestion={null} visuals={undefined} />,
    );
    expect(html).toContain("Setting up the experiment…");
  });
});
