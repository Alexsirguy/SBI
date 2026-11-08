// @vitest-environment happy-dom
import type { TeacherClass } from "@sbi/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { button, click, find, mount, text } from "../lesson/dom-test";

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

  it("lists each class with a way into its edit, lessons and controls", async () => {
    const archived = {
      ...CLASS,
      archivedAt: "2026-11-01T09:00:00.000Z",
      classId: CLASS.classId.replace("e1", "e2"),
      name: "Old class",
    };
    respond({
      classSummary: { minCount: 5, totals: {}, weeks: [] },
      classes: { classes: [{ ...CLASS, lessons: [LESSON] }, archived], educator: true },
      getAccount: ACCOUNT,
    });
    const { container } = await view();
    await vi.waitFor(() => expect(text(container)).toContain("SSS2 Physics"));
    expect(text(container)).toContain("Nigeria · SSS2");
    expect(text(container)).toContain("1 lesson");
    // The form stays closed until asked for, once there is a class.
    expect(container.querySelector("form")).toBeNull();
    const links = [...find(container, ".teach-cards").querySelectorAll("a")];
    expect(links.map((a) => [text(a), a.getAttribute("href")])).toEqual([
      ["Edit class: SSS2 Physics", `/teach/class?id=${CLASS.classId}&tab=edit`],
      ["Lessons: SSS2 Physics", `/teach/class?id=${CLASS.classId}&tab=lessons`],
      ["Controls: SSS2 Physics", `/teach/class?id=${CLASS.classId}&tab=controls`],
    ]);
    expect(text(find(container, "details"))).toContain("Archived classes (1)");

    await click(button(container, "New class"));
    expect(container.querySelector("form")).not.toBeNull();
  });
});
