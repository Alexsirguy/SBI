// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, text } from "./dom-test";

const api = vi.hoisted(() => vi.fn());
vi.mock("../api", () => ({ api }));

const { NextConcepts } = await import("./next-concepts");
const LESSON = "0192f1a0-0000-7000-8000-0000000000c1";

afterEach(() => {
  document.body.replaceChildren();
  api.mockReset();
});

const view = () =>
  mount(
    <QueryClientProvider client={new QueryClient()}>
      <NextConcepts lessonId={LESSON} version={2} prefs={{ age: "none", depth: "explore" }} />
    </QueryClientProvider>,
  );

describe("NextConcepts", () => {
  it("lists graph suggestions with why, and records which one was followed", async () => {
    api.mockImplementation(async (name: string) =>
      name === "relatedLessons"
        ? {
            related: [
              { distance: 1, label: "Saucepan", taxonomyId: "object.saucepan", via: "boiling" },
              { distance: 2, label: "Whisk", taxonomyId: "object.whisk", via: "family" },
            ],
          }
        : { ok: true },
    );
    const { container } = await view();
    await vi.waitFor(() => expect(text(container)).toContain("Next concepts"));
    expect(text(container)).toContain("Also about boiling");
    expect(text(container)).toContain("From the same family");
    expect(api).toHaveBeenCalledWith("relatedLessons", { lessonId: LESSON, version: "2" });

    const link = [...container.querySelectorAll("a")].find((a) => a.textContent === "Whisk");
    link?.addEventListener("click", (event) => event.preventDefault());
    await act(async () => link?.click());

    expect(api).toHaveBeenCalledWith("recordNextConcept", {
      fromLessonId: LESSON,
      rank: 1,
      toTaxonomyId: "object.whisk",
    });
  });

  it("shows nothing when there is nothing related", async () => {
    api.mockResolvedValue({ related: [] });
    const { container } = await view();
    await act(async () => undefined);
    expect(text(container)).toBe("");
  });
});
