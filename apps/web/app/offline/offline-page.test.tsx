// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { button, click, mount, text } from "../lesson/dom-test";
import { TEST_PACK } from "./offline-test-pack";
import { memoryPacks, type PackStore } from "./packs";

const params = vi.hoisted(() => ({ current: new URLSearchParams() }));
const push = vi.hoisted(() => vi.fn());
const api = vi.hoisted(() => vi.fn());
vi.mock("../api", () => ({ api }));
vi.mock("../../env", () => ({ webEnv: { apiUrl: "http://api.test", features: {} } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params.current,
}));

const { OfflinePage } = await import("./offline-page");

afterEach(() => {
  document.body.replaceChildren();
  push.mockReset();
  api.mockReset();
});

const view = (store: PackStore) =>
  mount(
    <QueryClientProvider client={new QueryClient()}>
      <OfflinePage store={store} />
    </QueryClientProvider>,
  );

async function upload(input: HTMLInputElement, contents: string) {
  const file = new File([contents], "lesson.sbipack.json", { type: "application/json" });
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}

describe("OfflinePage", () => {
  it("lists saved lessons and removes one", async () => {
    params.current = new URLSearchParams();
    const store = memoryPacks();
    await store.save(TEST_PACK);
    const { container } = await view(store);
    await vi.waitFor(() => expect(text(container)).toContain(TEST_PACK.lesson.title));
    expect(
      container.querySelector(`a[href="/offline?id=${TEST_PACK.lesson.lessonId}"]`),
    ).not.toBeNull();

    await click(button(container, `Remove ${TEST_PACK.lesson.title}`));
    await vi.waitFor(() => expect(text(container)).toContain("No lessons saved for offline yet"));
  });

  it("adds a lesson from a file, and refuses a file that isn't one", async () => {
    params.current = new URLSearchParams();
    const store = memoryPacks();
    const { container } = await view(store);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("no file input");

    await upload(input, JSON.stringify({ hello: "world" }));
    await vi.waitFor(() => expect(text(container)).toContain("isn't a saved lesson"));
    expect(await store.list()).toEqual([]);

    await upload(input, JSON.stringify(TEST_PACK));
    await vi.waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/offline?id=${TEST_PACK.lesson.lessonId}`),
    );
    expect(await store.list()).toHaveLength(1);
  });

  it("opens a saved lesson with its held-back visual as words, making no requests", async () => {
    const store = memoryPacks();
    await store.save(TEST_PACK);
    params.current = new URLSearchParams({ id: TEST_PACK.lesson.lessonId });
    const { container } = await view(store);
    await vi.waitFor(() => expect(text(container)).toContain(TEST_PACK.lesson.title));
    expect(text(container)).toContain("can't be saved for offline use under its licence");
    expect(text(container)).toContain("Light bends as it enters the glass");
    expect(api).not.toHaveBeenCalled();
  });

  it("says when a lesson isn't on this device", async () => {
    params.current = new URLSearchParams({ id: "0192f1a0-0000-7000-8000-0000000000ff" });
    const { container } = await view(memoryPacks());
    await vi.waitFor(() => expect(text(container)).toContain("isn't saved on this device"));
  });
});
