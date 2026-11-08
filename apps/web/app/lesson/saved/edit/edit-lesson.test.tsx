// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_MERRILL_LESSON } from "../../sample-merrill-lesson";
import { button, click, mount, text } from "../../dom-test";

const api = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock("../../../api", () => ({ api }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams({ id: SAMPLE_MERRILL_LESSON.lessonId }),
}));

const { EditLesson } = await import("./edit-lesson");
const lesson = SAMPLE_MERRILL_LESSON;
const COPY = "0192f1a0-0000-7000-8000-0000000000d7";

afterEach(() => {
  document.body.replaceChildren();
  api.mockReset();
  push.mockReset();
});

async function type(control: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    const proto = Object.getPrototypeOf(control) as object;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function respond() {
  api.mockImplementation(async (name: string) =>
    name === "openSavedLesson"
      ? {
          lesson,
          savedAt: "2026-11-08T09:00:00.000Z",
          sources: { lessonId: lesson.lessonId, sources: [] },
          visuals: { lessonId: lesson.lessonId, visuals: [] },
        }
      : {
          classesUpdated: 2,
          lesson: {
            lessonId: COPY,
            savedAt: "2026-11-08T12:00:00.000Z",
            sharedAt: null,
            title: lesson.title,
            version: 1,
          },
        },
  );
}

const view = () =>
  mount(
    <QueryClientProvider client={new QueryClient()}>
      <EditLesson />
    </QueryClientProvider>,
  );

describe("EditLesson", () => {
  it("sends only the section and question that changed, then opens the edited copy", async () => {
    respond();
    const { container } = await view();
    await vi.waitFor(() => expect(text(container)).toContain(`Edit: ${lesson.title}`));
    const texts = [...container.querySelectorAll("textarea")];
    const section = lesson.sections[0];
    const sectionText = texts.find((area) => area.value === section?.text);
    if (!sectionText || !section) throw new Error("no section text");
    await type(sectionText, "A shorter problem.");

    const task = lesson.tasks[0];
    if (!task) throw new Error("sample needs a question");
    const other = (task.answerIndex + 1) % task.options.length;
    const radios = [
      ...container.querySelectorAll<HTMLInputElement>(`input[name="right-${task.taskId}"]`),
    ];
    await act(async () => radios[other]?.click());

    await click(button(container, "Save edits"));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith(`/lesson/saved?id=${COPY}&edited=2`));
    expect(api).toHaveBeenCalledWith("editSavedLesson", {
      lessonId: lesson.lessonId,
      sections: [
        { heading: section.heading, sectionId: section.sectionId, text: "A shorter problem." },
      ],
      summary: undefined,
      tasks: [
        {
          answerIndex: other,
          feedback: task.feedback,
          options: task.options,
          prompt: task.prompt,
          taskId: task.taskId,
        },
      ],
      title: undefined,
    });
  });

  it("says so when nothing has changed, and sends nothing", async () => {
    respond();
    const { container } = await view();
    await vi.waitFor(() => expect(text(container)).toContain("Save edits"));
    await click(button(container, "Save edits"));
    expect(text(container)).toContain("Nothing has changed yet.");
    expect(api).not.toHaveBeenCalledWith("editSavedLesson", expect.anything());
  });
});
