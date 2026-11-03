// @vitest-environment happy-dom
import type { ControlSetting, TutorExchange } from "@sbi/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../api-client";
import { button, click, find, mount, text } from "../dom-test";
import type { ExperimentController } from "../experiment";
import { PracticeProvider } from "../practice";
import { SAMPLE_LESSON, SAMPLE_SOURCES } from "../sample-lesson";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../api", () => ({ api }));

const { default: Tutor } = await import("./tutor-panel");

const VISUAL = "0192f1a0-0000-7000-8000-00000000e001";
const refraction = SAMPLE_LESSON.claims[0]?.claimId ?? "";

const exchange = (overrides: Partial<TutorExchange> = {}): TutorExchange => ({
  turnId: crypto.randomUUID(),
  userText: "Why does it bend?",
  text: "Light slows in glass, so it bends.",
  citedClaimIds: [refraction],
  kind: "lesson",
  createdAt: "2026-11-03T10:00:00.000Z",
  ...overrides,
});

function screen(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: wide && query.includes("min-width"),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

function fakeController() {
  const applied: ControlSetting[][] = [];
  const highlighted: (string | undefined)[] = [];
  const controller = {
    visualId: VISUAL,
    has: () => true,
    set: () => true,
    apply: (settings: ControlSetting[]) => (applied.push(settings), true),
    values: () => ({}),
    readout: () => undefined,
    subscribe: () => () => undefined,
    highlight: (id: string | undefined) => (highlighted.push(id), true),
    reveal: vi.fn(),
  } satisfies ExperimentController;
  return { controller, applied, highlighted };
}

function answering(replies: TutorExchange[], history: TutorExchange[] = []) {
  api.mockImplementation(async (name: string) => {
    if (name === "getAccount") throw new ApiRequestError("Sign in", 401);
    if (name === "tutorConversation") return { exchanges: history };
    if (name === "askTutor") return { exchange: replies.shift() };
    if (name === "resetTutorConversation") return { deleted: history.length };
    throw new Error(`unexpected ${name}`);
  });
}

const view = (controller = fakeController().controller) =>
  mount(
    <QueryClientProvider client={new QueryClient()}>
      <PracticeProvider experiment={{ status: "ready", controller }}>
        <Tutor
          lesson={SAMPLE_LESSON}
          sources={SAMPLE_SOURCES}
          prefs={{ depth: "quick", age: "child" }}
        />
      </PracticeProvider>
    </QueryClientProvider>,
  );

async function ask(container: Element, question: string) {
  const input = find(container, "input") as HTMLInputElement;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, question);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click(button(container, "Ask"));
}

afterEach(() => {
  document.body.replaceChildren();
  api.mockReset();
  window.sessionStorage.clear();
});

describe("Tutor", () => {
  it("asks at the lesson's depth and age, then shows the reply with its sources", async () => {
    screen(true);
    answering([exchange()]);
    const { container } = await view();
    const log = await vi.waitFor(() => find(container, '[role="log"]'));
    expect(log.getAttribute("aria-live")).toBe("polite");
    await ask(container, "Why does it bend?");

    await vi.waitFor(() => expect(text(log)).toContain("Light slows in glass"));
    expect(api).toHaveBeenCalledWith(
      "askTutor",
      expect.objectContaining({
        lessonId: SAMPLE_LESSON.lessonId,
        lessonVersion: SAMPLE_LESSON.version,
        readingLevel: "simple",
        audience: "child",
        locale: SAMPLE_LESSON.locale,
        text: "Why does it bend?",
      }),
    );
    const links = [...log.querySelectorAll("a")];
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["#source-1", "#source-2"]);
    expect(links[0]?.getAttribute("aria-label")).toBe("source 1");
    expect((find(container, "input") as HTMLInputElement).value).toBe("");
  });

  it("keeps one visit's conversation under one random id per lesson", async () => {
    screen(true);
    answering([]);
    await view();
    await vi.waitFor(() =>
      expect(api).toHaveBeenCalledWith("tutorConversation", expect.anything()),
    );
    const [, first] = api.mock.calls.find(([name]) => name === "tutorConversation") ?? [];
    document.body.replaceChildren();
    api.mockClear();
    await view();
    await vi.waitFor(() => expect(api).toHaveBeenCalledWith("tutorConversation", first));
  });

  it("shows the note on a reply from beyond the lesson, and a policy reply's help", async () => {
    screen(true);
    answering(
      [],
      [
        exchange({
          citedClaimIds: [],
          kind: "beyond-lesson",
          note: "This goes beyond the lesson's sources.",
        }),
        exchange({
          citedClaimIds: [],
          kind: "policy",
          text: "We can't help with that.",
          policy: {
            reason: "harm",
            message: "We can't help with that.",
            help: ["Talk to a grown-up you trust."],
            policyVersion: "safety-2",
          },
        }),
      ],
    );
    const { container } = await view();
    await vi.waitFor(() =>
      expect(text(container)).toContain("This goes beyond the lesson's sources."),
    );
    expect(text(container)).toContain("Talk to a grown-up you trust.");
  });

  it("plays a reply's visual action on the lesson's own visual", async () => {
    screen(true);
    const fake = fakeController();
    const settings = [{ controlId: "angle", value: 30 }];
    answering([], [exchange({ visualAction: { visualId: VISUAL, settings, highlight: "lens" } })]);
    const { container } = await view(fake.controller);
    await click(await vi.waitFor(() => button(container, /Watch it on the visual/)));
    expect(fake.applied).toEqual([settings]);
    expect(fake.highlighted).toEqual(["lens"]);
    expect(fake.controller.reveal).toHaveBeenCalled();
    expect(text(container)).toContain("The visual now shows this.");
  });

  it("clears the conversation when asked", async () => {
    screen(true);
    answering([], [exchange()]);
    const { container } = await view();
    await click(await vi.waitFor(() => button(container, "Clear conversation")));
    await vi.waitFor(() => expect(text(container)).toContain("Conversation cleared."));
    expect(text(find(container, '[role="log"]'))).not.toContain("Light slows");
    expect(text(container)).toContain("Kept for this visit only.");
  });

  it("says so, and keeps the lesson, when the tutor is unavailable", async () => {
    screen(true);
    api.mockImplementation(async (name: string) => {
      if (name === "getAccount") return null;
      throw new ApiRequestError("unavailable", 503);
    });
    const { container } = await view();
    await vi.waitFor(() => expect(text(container)).toContain("The tutor isn't available"));
    expect(container.querySelector("form")).toBeNull();
  });

  it("opens as a sheet on narrow screens and gives focus back when it closes", async () => {
    screen(false);
    answering([]);
    const { container } = await view();
    const launcher = button(container, "Ask the tutor");
    expect(launcher.getAttribute("aria-haspopup")).toBe("dialog");
    await click(launcher);
    const sheet = find(container, "dialog") as HTMLDialogElement;
    expect(sheet.open).toBe(true);
    await click(button(sheet, "Close the tutor"));
    expect(sheet.open).toBe(false);
    expect(document.activeElement).toBe(launcher);
  });
});
