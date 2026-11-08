// @vitest-environment happy-dom
import type { TeacherClass } from "@sbi/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { button, click, mount, text } from "../lesson/dom-test";

const api = vi.hoisted(() => vi.fn());
vi.mock("../api", () => ({ api }));

const { AddToClass } = await import("./add-to-class");

const LESSON_ID = "0192f1a0-0000-7000-8000-0000000000c1";
const ACCOUNT = { accountId: "0192f1a0-0000-7000-8000-000000000001", email: "t@example.com" };
const physics: TeacherClass = {
  archivedAt: null,
  classId: "0192f1a0-0000-7000-8000-0000000000e1",
  codeHint: "PX",
  joinCode: "7K3M-9QPX",
  controls: { audienceLock: null, blockedCategories: [], tutorEnabled: true },
  createdAt: "2026-11-08T09:00:00.000Z",
  curriculum: "ng",
  lessons: [],
  level: "SSS2",
  name: "SSS2 Physics",
};
const chemistry = {
  ...physics,
  classId: "0192f1a0-0000-7000-8000-0000000000e2",
  name: "SSS1 Chemistry",
};
const saved = (version: number) => ({
  lessonId: LESSON_ID,
  savedAt: "2026-11-08T09:00:00.000Z",
  sharedAt: null,
  title: "Kettles",
  version,
});

afterEach(() => {
  document.body.replaceChildren();
  api.mockReset();
});

function respond(routes: Record<string, unknown>) {
  api.mockImplementation(async (name: string, body: unknown) => {
    const answer = routes[name];
    return typeof answer === "function" ? (answer as (b: unknown) => unknown)(body) : answer;
  });
}

const view = (version = 2) =>
  mount(
    <QueryClientProvider client={new QueryClient()}>
      <AddToClass lessonId={LESSON_ID} version={version} />
    </QueryClientProvider>,
  );

describe("AddToClass", () => {
  it("shows nothing to a learner who isn't teaching", async () => {
    respond({
      classes: { classes: [], educator: false },
      getAccount: ACCOUNT,
      savedLessons: { lessons: [] },
    });
    const { container } = await view();
    await act(async () => undefined);
    expect(text(container)).toBe("");
  });

  it("saves the version on screen first, then adds it to the class", async () => {
    respond({
      addClassLesson: () => ({
        class: { ...physics, lessons: [{ lessonId: LESSON_ID, title: "Kettles", version: 2 }] },
      }),
      classes: { classes: [physics], educator: true },
      getAccount: ACCOUNT,
      saveLesson: saved(2),
      savedLessons: { lessons: [saved(1)] },
    });
    const { container } = await view(2);
    await vi.waitFor(() => expect(text(container)).toContain("Add to SSS2 Physics"));
    await click(button(container, "Add to SSS2 Physics"));
    await vi.waitFor(() => expect(text(container)).toContain("Added to SSS2 Physics."));
    const calls = api.mock.calls.map(([name]) => name);
    expect(calls.indexOf("saveLesson")).toBeLessThan(calls.indexOf("addClassLesson"));
    expect(api).toHaveBeenCalledWith("saveLesson", { lessonId: LESSON_ID, version: 2 });
    expect(api).toHaveBeenCalledWith("addClassLesson", {
      classId: physics.classId,
      lessonId: LESSON_ID,
    });
  });

  it("lets a teacher with several classes choose, and says when this version is already there", async () => {
    respond({
      classes: {
        classes: [
          physics,
          { ...chemistry, lessons: [{ lessonId: LESSON_ID, title: "Kettles", version: 2 }] },
        ],
        educator: true,
      },
      getAccount: ACCOUNT,
      savedLessons: { lessons: [saved(2)] },
    });
    const { container } = await view(2);
    await vi.waitFor(() => expect(container.querySelector("select")).not.toBeNull());
    const select = container.querySelector("select");
    await act(async () => {
      if (!select) return;
      select.value = chemistry.classId;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(text(container)).toContain("This version is in SSS1 Chemistry.");
  });
});
