// @vitest-environment happy-dom
import type { TeacherClass } from "@sbi/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { button, click, find, mount, text } from "../lesson/dom-test";

const api = vi.hoisted(() => vi.fn());
const params = vi.hoisted(() => ({ current: new URLSearchParams() }));
vi.mock("../api", () => ({ api }));
vi.mock("next/navigation", () => ({ useSearchParams: () => params.current }));

const { ClassPage } = await import("./class-page");

const ACCOUNT = { accountId: "0192f1a0-0000-7000-8000-000000000001", email: "t@example.com" };
const LESSON = { lessonId: "0192f1a0-0000-7000-8000-0000000000c1", title: "Kettles", version: 1 };
const OTHER = { lessonId: "0192f1a0-0000-7000-8000-0000000000c2", title: "Lenses", version: 1 };
const CLASS: TeacherClass = {
  archivedAt: null,
  classId: "0192f1a0-0000-7000-8000-0000000000e1",
  codeHint: "PX",
  controls: { audienceLock: null, blockedCategories: [], tutorEnabled: true },
  createdAt: "2026-11-08T09:00:00.000Z",
  curriculum: "ng",
  lessons: [LESSON],
  level: "SSS2",
  name: "SSS2 Physics",
};
const SAVED = [LESSON, OTHER].map((lesson) => ({
  ...lesson,
  savedAt: "2026-11-08T09:00:00.000Z",
  sharedAt: null,
}));

afterEach(() => {
  document.body.replaceChildren();
  api.mockReset();
});

function respond(routes: Record<string, unknown>) {
  api.mockImplementation(async (name: string, body: unknown) => {
    const answer = routes[name];
    if (answer instanceof Error) throw answer;
    return typeof answer === "function" ? (answer as (b: unknown) => unknown)(body) : answer;
  });
}

const base = {
  classSummary: { minCount: 5, totals: {}, weeks: [] },
  classes: { classes: [CLASS], educator: true },
  getAccount: ACCOUNT,
  savedLessons: { lessons: SAVED },
};

async function open(tab: string | null, classId = CLASS.classId) {
  params.current = new URLSearchParams(tab ? { id: classId, tab } : { id: classId });
  const result = await mount(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ClassPage />
    </QueryClientProvider>,
  );
  await vi.waitFor(() => expect(result.container.querySelector("h1")).not.toBeNull());
  return result.container;
}

const link = (scope: Element, name: string) =>
  [...scope.querySelectorAll("a")].find((a) => text(a) === name);

describe("ClassPage", () => {
  it("opens on lessons, with the class's overview and tabs", async () => {
    respond(base);
    const page = await open(null);
    expect(text(find(page, "h1"))).toBe("SSS2 Physics");
    expect(text(page)).toContain("Class summary");
    const current = page.querySelector("[aria-current=page]");
    expect(current && text(current)).toBe("Lessons");
    expect(link(page, "Controls")?.getAttribute("href")).toBe(
      `/teach/class?id=${CLASS.classId}&tab=controls`,
    );
    expect(link(page, "← All classes")?.getAttribute("href")).toBe("/teach");
  });

  it("lists the class's lessons, and adds a saved one with one press", async () => {
    respond({
      ...base,
      addClassLesson: { class: { ...CLASS, lessons: [LESSON, OTHER] } },
    });
    const page = await open("lessons");
    await vi.waitFor(() => expect(text(page)).toContain("Add Lenses"));
    expect(text(page)).toContain("In this class (1)");
    expect(link(page, "Open Kettles")?.getAttribute("href")).toBe(
      `/lesson/saved?id=${LESSON.lessonId}`,
    );
    expect(link(page, "Edit Kettles")?.getAttribute("href")).toBe(
      `/lesson/saved/edit?id=${LESSON.lessonId}`,
    );

    await click(button(page, "Add Lenses"));
    await vi.waitFor(() => expect(text(page)).toContain("In this class (2)"));
    expect(api).toHaveBeenCalledWith("addClassLesson", {
      classId: CLASS.classId,
      lessonId: OTHER.lessonId,
    });
    expect(text(page)).toContain("Every lesson you saved is already in this class.");
  });

  it("removes a lesson", async () => {
    respond({ ...base, removeClassLesson: { class: { ...CLASS, lessons: [] } } });
    const page = await open("lessons");
    await click(button(page, "Remove Kettles"));
    await vi.waitFor(() => expect(text(page)).toContain("In this class (0)"));
    expect(api).toHaveBeenCalledWith("removeClassLesson", {
      classId: CLASS.classId,
      lessonId: LESSON.lessonId,
    });
  });

  it("saves the controls on their own tab", async () => {
    respond({
      ...base,
      updateClass: (body: { controls: TeacherClass["controls"] }) => ({
        class: { ...CLASS, controls: body.controls },
      }),
    });
    const page = await open("controls");
    const weapons = [...page.querySelectorAll("label")].find((l) => text(l) === "Weapons");
    await act(async () => weapons?.querySelector("input")?.click());
    await click(button(page, "Save controls"));
    await vi.waitFor(() => expect(text(page)).toContain("Controls saved."));
    expect(api).toHaveBeenCalledWith("updateClass", {
      classId: CLASS.classId,
      controls: { audienceLock: null, blockedCategories: ["weapons"], tutorEnabled: true },
    });
  });

  it("makes a new code from the edit tab and shows it once", async () => {
    respond({ ...base, rotateClassCode: { class: CLASS, joinCode: "7K3M-9QPX" } });
    const page = await open("edit");
    expect(text(page)).toContain("Class details");
    await click(button(page, "Make a new code"));
    await vi.waitFor(() => expect(text(page)).toContain("7K3M-9QPX"));
    await click(button(page, "Done"));
    expect(text(page)).not.toContain("7K3M-9QPX");
  });

  it("shows only restore for an archived class", async () => {
    const archived = { ...CLASS, archivedAt: "2026-11-01T09:00:00.000Z" };
    respond({ ...base, classes: { classes: [archived], educator: true } });
    const page = await open("lessons");
    expect(text(page)).toContain("Restore class");
    expect(page.querySelector("nav")).toBeNull();
  });

  it("says when the class isn't one of the teacher's", async () => {
    respond(base);
    const page = await open("lessons", "0192f1a0-0000-7000-8000-0000000000ff");
    expect(text(find(page, "h1"))).toBe("That class could not be found.");
  });
});
