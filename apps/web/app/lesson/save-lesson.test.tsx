// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { button, click, mount, text } from "./dom-test";

const api = vi.hoisted(() => vi.fn());
vi.mock("../api", () => ({ api }));

const { SaveLesson } = await import("./save-lesson");

const LESSON = "0192f1a0-0000-7000-8000-0000000000c1";
const ACCOUNT = {
  accountId: "0192f1a0-0000-7000-8000-000000000001",
  email: "ada@example.com",
  emailVerified: true,
  firstName: "Ada",
  lastName: "Lovelace",
  linkedAt: null,
};

afterEach(() => {
  document.body.replaceChildren();
  api.mockReset();
});

function signedIn(saved: { lessonId: string; version: number }[]) {
  const list = saved.map((item) => ({
    ...item,
    savedAt: "2026-11-03T09:00:00.000Z",
    title: "Kettles",
  }));
  api.mockImplementation(async (name: string, body: { lessonId: string; version: number }) => {
    if (name === "getAccount") return ACCOUNT;
    if (name === "savedLessons") return { lessons: list };
    if (name === "saveLesson")
      return { ...body, savedAt: "2026-11-03T10:00:00.000Z", title: "Kettles" };
    return { ok: true };
  });
}

// The button is disabled until the saved list loads; clicking earlier would do nothing.
const enabled = (scope: Element, name: string | RegExp) =>
  vi.waitFor(() => {
    const found = button(scope, name);
    expect(found.disabled).toBe(false);
    return found;
  });

const view = (version = 2) =>
  mount(
    <QueryClientProvider client={new QueryClient()}>
      <SaveLesson lessonId={LESSON} version={version} returnTo="/lesson?label=Kettle" />
    </QueryClientProvider>,
  );

describe("SaveLesson", () => {
  it("saves the version on screen and nothing else, such as a photo", async () => {
    signedIn([]);
    const { container } = await view(2);
    await click(await enabled(container, "Save lesson"));

    await vi.waitFor(() => expect(text(container)).toContain("Saved to your account."));
    expect(api).toHaveBeenCalledWith("saveLesson", { lessonId: LESSON, version: 2 });
    expect(api.mock.calls.map(([name]) => name)).not.toContain("keepPhoto");
    expect(button(container, /^Saved/).getAttribute("aria-pressed")).toBe("true");
  });

  it("offers to save this version when an older one is saved", async () => {
    signedIn([{ lessonId: LESSON, version: 1 }]);
    const { container } = await view(2);
    await enabled(container, "Save this version");
  });

  it("removes a saved lesson when pressed again", async () => {
    signedIn([{ lessonId: LESSON, version: 2 }]);
    const { container } = await view(2);
    await click(await enabled(container, /^Saved/));

    await vi.waitFor(() => expect(text(container)).toContain("Removed from saved lessons."));
    expect(api).toHaveBeenCalledWith("removeSavedLesson", { lessonId: LESSON });
  });
});
