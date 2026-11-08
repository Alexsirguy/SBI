// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, text } from "../lesson/dom-test";

const api = vi.hoisted(() => vi.fn());
const params = vi.hoisted(() => ({ current: new URLSearchParams() }));
vi.mock("../api", () => ({ api }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => params.current,
}));

const { ClassPage } = await import("./class-page");
const { readClass } = await import("./class-context");
const { readCurriculum } = await import("../lesson/curriculum-pref");
const { ApiRequestError } = await import("../api-client");

afterEach(() => {
  document.body.replaceChildren();
  api.mockReset();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

const view = () =>
  mount(
    <QueryClientProvider client={new QueryClient()}>
      <ClassPage />
    </QueryClientProvider>,
  );

describe("ClassPage", () => {
  it("asks for a code when there isn't one", async () => {
    params.current = new URLSearchParams();
    const { container } = await view();
    expect(text(container)).toContain("Join a class");
    expect(container.querySelector("input")).not.toBeNull();
    expect(api).not.toHaveBeenCalled();
  });

  it("lists the class's lessons, enters the class and starts from its curriculum", async () => {
    params.current = new URLSearchParams({ code: "7K3M-9QPX" });
    api.mockResolvedValue({
      controls: { audienceLock: "child", blockedCategories: [], tutorEnabled: false },
      curriculum: "ng",
      lessons: [{ lessonId: "0192f1a0-0000-7000-8000-0000000000c1", title: "Kettles", version: 1 }],
      level: "SSS2",
      name: "SSS2 Physics",
    });
    const { container } = await view();
    await vi.waitFor(() => expect(text(container)).toContain("SSS2 Physics"));
    expect(api).toHaveBeenCalledWith("openClass", { code: "7K3M-9QPX" });
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "/class/lesson?code=7K3M-9QPX&id=0192f1a0-0000-7000-8000-0000000000c1",
    );
    expect(text(container)).toContain("turned the tutor off");
    expect(readClass()).toEqual({ code: "7K3M-9QPX", name: "SSS2 Physics", tutorEnabled: false });
    expect(readCurriculum()).toEqual({ curriculum: "ng", level: "SSS2" });
  });

  it("keeps a pupil's own curriculum choice", async () => {
    window.localStorage.setItem("sbi.curriculum", JSON.stringify({ curriculum: "us" }));
    params.current = new URLSearchParams({ code: "7K3M-9QPX" });
    api.mockResolvedValue({
      controls: { audienceLock: null, blockedCategories: [], tutorEnabled: true },
      curriculum: "ng",
      lessons: [],
      level: null,
      name: "SSS2 Physics",
    });
    const { container } = await view();
    await vi.waitFor(() => expect(text(container)).toContain("hasn't added any lessons"));
    expect(readCurriculum()).toEqual({ curriculum: "us" });
  });

  it("says when a link no longer works and lets the pupil try another code", async () => {
    params.current = new URLSearchParams({ code: "GONE" });
    api.mockRejectedValue(new ApiRequestError("This class link doesn't work any more.", 404));
    const { container } = await view();
    await vi.waitFor(() => expect(text(container)).toContain("doesn't work any more"));
    expect(container.querySelector("input")?.value).toBe("GONE");
  });
});
