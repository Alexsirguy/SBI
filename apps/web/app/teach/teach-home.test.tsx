// @vitest-environment happy-dom
import type { TeacherClass } from "@sbi/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { button, click, mount, text } from "../lesson/dom-test";

const api = vi.hoisted(() => vi.fn());
vi.mock("../api", () => ({ api }));

const { TeachHome } = await import("./teach-home");
const { ApiRequestError } = await import("../api-client");

const ACCOUNT = { accountId: "0192f1a0-0000-7000-8000-000000000001", email: "t@example.com" };
const LESSON = { lessonId: "0192f1a0-0000-7000-8000-0000000000c1", title: "Kettles", version: 1 };
const CLASS: TeacherClass = {
  archivedAt: null,
  classId: "0192f1a0-0000-7000-8000-0000000000e1",
  codeHint: "PX",
  controls: { audienceLock: null, blockedCategories: [], tutorEnabled: true },
  createdAt: "2026-11-08T09:00:00.000Z",
  curriculum: "ng",
  lessons: [],
  level: "SSS2",
  name: "SSS2 Physics",
};

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

const view = () =>
  mount(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <TeachHome />
    </QueryClientProvider>,
  );

async function type(input: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const proto = Object.getPrototypeOf(input) as object;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(input, value);
    input.dispatchEvent(
      new Event(input instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
    );
  });
}

function field<T extends HTMLElement>(scope: Element, label: string): T {
  const found = [...scope.querySelectorAll("label")].find((item) => text(item).startsWith(label));
  const control = found?.htmlFor ? scope.querySelector(`#${CSS.escape(found.htmlFor)}`) : null;
  if (!control) throw new Error(`no field labelled ${label}`);
  return control as T;
}

describe("TeachHome", () => {
  it("asks a signed-out visitor to sign in", async () => {
    respond({ getAccount: new ApiRequestError("Sign in", 401) });
    const { container } = await view();
    await vi.waitFor(() => expect(text(container)).toContain("Sign in with an adult account"));
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "/account/sign-in?next=%2Fteach",
    );
  });

  it("turns teaching tools on, then offers a new class", async () => {
    respond({
      becomeEducator: { educator: true },
      classes: { classes: [], educator: false },
      getAccount: ACCOUNT,
    });
    const { container } = await view();
    await vi.waitFor(() => expect(text(container)).toContain("For adults aged 18 or over"));
    await click(button(container, "Turn on teaching tools"));
    await vi.waitFor(() => expect(text(container)).toContain("New class"));
    expect(api).toHaveBeenCalledWith("becomeEducator", {});
  });

  it("shows the new class's code once, then hides it", async () => {
    respond({
      classes: { classes: [], educator: true },
      createClass: (body: { name: string }) => ({
        class: { ...CLASS, name: body.name },
        joinCode: "7K3M-9QPX",
      }),
      getAccount: ACCOUNT,
      savedLessons: { lessons: [] },
    });
    const { container } = await view();
    await vi.waitFor(() => expect(text(container)).toContain("New class"));
    await type(field<HTMLInputElement>(container, "Class name"), "SSS2 Physics");
    await type(field<HTMLSelectElement>(container, "Curriculum"), "ng");
    await type(field<HTMLSelectElement>(container, "Level"), "SSS2");
    await click(button(container, "Create class"));

    await vi.waitFor(() => expect(text(container)).toContain("7K3M-9QPX"));
    expect(api).toHaveBeenCalledWith("createClass", {
      curriculum: "ng",
      level: "SSS2",
      name: "SSS2 Physics",
    });
    expect(text(container)).toContain("/class?code=7K3M-9QPX");
    await click(button(container, "Done"));
    expect(text(container)).not.toContain("7K3M-9QPX");
    expect(text(container)).toContain("Code ends in PX");
  });

  it("adds a saved lesson and saves the controls", async () => {
    respond({
      addClassLesson: { class: { ...CLASS, lessons: [LESSON] } },
      classes: { classes: [CLASS], educator: true },
      getAccount: ACCOUNT,
      savedLessons: {
        lessons: [{ ...LESSON, savedAt: "2026-11-08T09:00:00.000Z", sharedAt: null }],
      },
      updateClass: (body: { controls: TeacherClass["controls"] }) => ({
        class: { ...CLASS, controls: body.controls },
      }),
    });
    const { container } = await view();
    await vi.waitFor(() => expect(text(container)).toContain("Add a saved lesson"));
    await type(field<HTMLSelectElement>(container, "Add a saved lesson"), LESSON.lessonId);
    await click(button(container, "Add lesson"));
    await vi.waitFor(() => expect(text(container)).toContain("Remove Kettles"));
    expect(api).toHaveBeenCalledWith("addClassLesson", {
      classId: CLASS.classId,
      lessonId: LESSON.lessonId,
    });

    await type(field<HTMLSelectElement>(container, "Age band for every lesson"), "child");
    const weapons = [...container.querySelectorAll("label")].find((l) => text(l) === "Weapons");
    await act(async () => weapons?.querySelector("input")?.click());
    const tutor = [...container.querySelectorAll("label")].find((l) =>
      text(l).startsWith("Pupils can ask the tutor"),
    );
    await act(async () => tutor?.querySelector("input")?.click());
    await click(button(container, "Save controls"));
    await vi.waitFor(() => expect(text(container)).toContain("Controls saved."));
    expect(api).toHaveBeenCalledWith("updateClass", {
      classId: CLASS.classId,
      controls: { audienceLock: "child", blockedCategories: ["weapons"], tutorEnabled: false },
    });
  });
});
