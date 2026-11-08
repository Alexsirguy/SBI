// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TEST_PACK } from "../offline/offline-test-pack";
import { memoryPacks, type PackStore } from "../offline/packs";
import { button, click, mount, text } from "./dom-test";

const api = vi.hoisted(() => vi.fn());
vi.mock("../api", () => ({ api }));

const { SaveOffline } = await import("./save-offline");

afterEach(() => {
  document.body.replaceChildren();
  api.mockReset();
});

const view = (store: PackStore) =>
  mount(
    <QueryClientProvider client={new QueryClient()}>
      <SaveOffline lessonId={TEST_PACK.lesson.lessonId} version={1} store={store} />
    </QueryClientProvider>,
  );

describe("SaveOffline", () => {
  it("asks the API for the pack and keeps it on the device", async () => {
    api.mockResolvedValue(TEST_PACK);
    const store = memoryPacks();
    const { container } = await view(store);
    await click(button(container, "Save for offline"));
    await vi.waitFor(() => expect(text(container)).toContain("Saved on this device."));
    expect(api).toHaveBeenCalledWith("exportLessonPack", {
      lessonId: TEST_PACK.lesson.lessonId,
      version: 1,
    });
    expect(await store.list()).toHaveLength(1);
    expect(container.querySelector('a[href="/offline"]')).not.toBeNull();
    expect(button(container, "Download file")).toBeTruthy();
  });

  it("still offers the file when the browser won't store it", async () => {
    api.mockResolvedValue(TEST_PACK);
    const refusing: PackStore = {
      ...memoryPacks(),
      save: async () => Promise.reject(new Error("quota")),
    };
    const { container } = await view(refusing);
    await click(button(container, "Save for offline"));
    await vi.waitFor(() => expect(text(container)).toContain("can't be stored in this browser"));
    expect(button(container, "Download file")).toBeTruthy();
  });

  it("says so when the pack can't be made", async () => {
    api.mockRejectedValue(new Error("Service unavailable"));
    const { container } = await view(memoryPacks());
    await click(button(container, "Save for offline"));
    await vi.waitFor(() => expect(text(container)).toContain("Couldn't save this lesson"));
  });
});
