// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { button, click, mount, radio, text } from "./dom-test";
import { SAMPLE_MERRILL_LESSON as lesson } from "./sample-merrill-lesson";

const track = vi.hoisted(() => vi.fn());
vi.mock("../analytics/track", () => ({ track }));

const { ConceptCheck } = await import("./concept-check");
const { ActivateSection } = await import("./modules/activate");
const { PracticeProvider } = await import("./practice");

const activate = lesson.sections.find((section) => section.module === "activate");
const guess = lesson.tasks.find((task) => task.module === "activate");
const ids = { lessonId: lesson.lessonId, version: lesson.version, topic: "object.acoustic-guitar" };

afterEach(() => {
  document.body.replaceChildren();
  track.mockReset();
});

const view = () =>
  mount(
    <PracticeProvider experiment={{ status: "none" }}>
      {activate ? <ActivateSection section={activate} task={guess} lesson={lesson} /> : null}
      <ConceptCheck lesson={lesson} />
    </PracticeProvider>,
  );

describe("the concept check (#81)", () => {
  it("counts the opening guess as the 'before' answer", async () => {
    const { container } = await view();
    const form = container.querySelector(".guess");
    if (!form) throw new Error("no guess form");
    await click(radio(form, "Loosen the string"));
    await click(button(form, "Lock in my guess"));
    expect(track).toHaveBeenCalledWith("concept_check_answered", {
      ...ids,
      itemId: "guess",
      instrument: "concept-check-v1",
      phase: "pre",
      correct: false,
      explanationOpened: false,
    });
  });

  it("asks the same question at the end and records the 'after' answer", async () => {
    const { container } = await view();
    const check = container.querySelector(".concept-check");
    if (!check) throw new Error("no concept check");
    expect(text(check)).toContain("Now what do you think?");
    expect(text(check)).toContain("Which change raises the pitch?");
    await click(radio(check, "Tighten the string"));
    await click(button(check, "Answer"));
    expect(text(check)).toContain("Right: Tighten the string.");
    expect(track).toHaveBeenCalledWith("concept_check_answered", {
      ...ids,
      itemId: "guess",
      instrument: "concept-check-v1",
      phase: "post",
      correct: true,
      explanationOpened: false,
    });
  });

  it("reports typed subjects only as 'subject', since their ids hold the learner's words", async () => {
    const typed = { ...lesson, taxonomyId: "subject.my-nans-old-radio" };
    const { container } = await mount(
      <PracticeProvider experiment={{ status: "none" }}>
        <ConceptCheck lesson={typed} />
      </PracticeProvider>,
    );
    await click(radio(container, "Tighten the string"));
    await click(button(container, "Answer"));
    expect(track.mock.calls[0]?.[1]).toMatchObject({ topic: "subject" });
  });

  it("isn't shown for a lesson without a guess", async () => {
    const { container } = await mount(
      <PracticeProvider experiment={{ status: "none" }}>
        <ConceptCheck lesson={{ ...lesson, tasks: [] }} />
      </PracticeProvider>,
    );
    expect(container.innerHTML).toBe("");
  });
});
