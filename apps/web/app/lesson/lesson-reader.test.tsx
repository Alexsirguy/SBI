// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, text } from "./dom-test";
import { DEFAULT_PREFS } from "./prefs";
import { SAMPLE_ANSWER, SAMPLE_LESSON, sseFrames } from "./sample-lesson";
import { SAMPLE_MERRILL_ANSWER, SAMPLE_MERRILL_LESSON } from "./sample-merrill-lesson";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api.test";
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const { LessonReader } = await import("./lesson-reader");

function streaming(events: { type: string; data: unknown }[]): typeof fetch {
  return () =>
    Promise.resolve(
      new Response(sseFrames(events), { headers: { "content-type": "text/event-stream" } }),
    );
}

async function render(events: { type: string; data: unknown }[], label: string) {
  const view = await mount(
    <QueryClientProvider client={new QueryClient()}>
      <LessonReader
        request={{
          question: "Why does it do that?",
          subject: label,
          audience: "general",
          readingLevel: "plain",
          locale: "en",
          safetyClass: "low",
          assumptions: [],
          fresh: false,
        }}
        label={label}
        prefs={DEFAULT_PREFS}
        fetcher={streaming(events)}
      />
    </QueryClientProvider>,
  );
  return view;
}

async function read(events: { type: string; data: unknown }[], label: string) {
  const view = await render(events, label);
  await vi.waitFor(() => expect(text(view.container)).toContain("Lesson ready."));
  await act(async () => undefined);
  return view;
}

afterEach(() => document.body.replaceChildren());

describe("LessonReader", () => {
  it("opens a Merrill lesson on its problem, with no quick answer to spoil the guess", async () => {
    const { container } = await read(
      [
        { type: "quick-answer", data: SAMPLE_MERRILL_ANSWER },
        { type: "lesson", data: SAMPLE_MERRILL_LESSON },
        { type: "visuals", data: { lessonId: SAMPLE_MERRILL_LESSON.lessonId, visuals: [] } },
      ],
      "Guitar",
    );
    expect(container.querySelector(".quick-answer")).toBeNull();
    expect(text(container)).not.toContain(SAMPLE_MERRILL_ANSWER.shortAnswer);
    const headings = [...container.querySelectorAll(".rail h2")].map(text);
    expect(headings[0]).toBe("Your guitar sounds flat");
    expect(headings).toHaveLength(5);
  });

  it("still reads a lesson drafted before Merrill as eight open steps", async () => {
    const { container } = await read(
      [
        { type: "quick-answer", data: SAMPLE_ANSWER },
        { type: "lesson", data: SAMPLE_LESSON },
        { type: "visuals", data: { lessonId: SAMPLE_LESSON.lessonId, visuals: [] } },
      ],
      "Magnifying glass",
    );
    expect(container.querySelectorAll(".rail h2")).toHaveLength(8);
    expect(container.querySelector(".guess-reveal")).toBeNull();
  });

  it("shows help, and no lesson or error, when the question sought harm", async () => {
    const policy = {
      category: "self-harm",
      message: "It sounds like things might be really hard right now.",
      help: ["If you might hurt yourself, call your local emergency number now."],
      policyVersion: "safety-1",
    };
    const { container } = await render([{ type: "policy", data: policy }], "Rope");
    const heading = await vi.waitFor(() => {
      const found = container.querySelector<HTMLElement>("#policy-heading");
      if (!found) throw new Error("no help yet");
      return found;
    });
    expect(text(heading)).toBe("You don't have to face this alone");
    expect(document.activeElement).toBe(heading);
    expect(text(container)).toContain("call your local emergency number now");
    expect(container.querySelector(".lesson-body")).toBeNull();
    expect(container.querySelector(".sbi-notice--error, [role=alert]")).toBeNull();
    expect(container.querySelector("a[href='/capture']")).not.toBeNull();
    expect(text(container)).not.toContain("Get a fresh answer");
  });
});
