// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { button, click, mount, text } from "../dom-test";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../api", () => ({ api }));

const { ShareLesson } = await import("./share-lesson");

const LESSON = "0192f1a0-0000-7000-8000-0000000000c1";

afterEach(() => {
  document.body.replaceChildren();
  api.mockReset();
});

function listed(sharedAt: string | null) {
  api.mockImplementation(async (name: string) =>
    name === "savedLessons"
      ? {
          lessons: [
            {
              lessonId: LESSON,
              savedAt: "2026-11-03T09:00:00.000Z",
              sharedAt,
              title: "K",
              version: 1,
            },
          ],
        }
      : { reviewStatus: "needs-review", sharedAt: "2026-11-03T10:00:00.000Z" },
  );
}

const view = () =>
  mount(
    <QueryClientProvider client={new QueryClient()}>
      <ShareLesson lessonId={LESSON} />
    </QueryClientProvider>,
  );

describe("ShareLesson", () => {
  it("says what is shared and what never is, then shares only when asked", async () => {
    listed(null);
    const { container } = await view();
    expect(text(container)).toContain("never your name, your photo, or what you typed");
    const share = await vi.waitFor(() => {
      const found = button(container, "Share this lesson");
      expect(found.disabled).toBe(false);
      return found;
    });
    expect(api).not.toHaveBeenCalledWith("shareSavedLesson", expect.anything());

    await click(share);

    await vi.waitFor(() => expect(text(container)).toContain("Shared. A reviewer checks it"));
    expect(api).toHaveBeenCalledWith("shareSavedLesson", { lessonId: LESSON });
  });

  it("shows a lesson already shared as shared", async () => {
    listed("2026-11-03T10:00:00.000Z");
    const { container } = await view();
    await vi.waitFor(() => expect(text(container)).toContain("Shared. A reviewer checks it"));
  });
});
