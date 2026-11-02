// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { button, click, mount, text } from "../lesson/dom-test";

const api = vi.hoisted(() => vi.fn());
vi.mock("../api", () => ({ api }));

const { YourChoices } = await import("./your-choices");
const { hasConsent, readKeptPhotos, rememberKeptPhoto, setConsent } = await import("../consent");

afterEach(() => {
  document.body.replaceChildren();
  window.localStorage.clear();
  api.mockReset();
});

const view = () =>
  mount(
    <QueryClientProvider client={new QueryClient()}>
      <YourChoices />
    </QueryClientProvider>,
  );

function keepTwo() {
  setConsent("save-photos", true);
  const keptAt = "2026-11-02T10:00:00.000Z";
  rememberKeptPhoto({ key: "photos/a.jpg", label: "Kettle", keptAt });
  rememberKeptPhoto({ key: "photos/b.jpg", label: "Bicycle", keptAt });
}

describe("YourChoices", () => {
  it("says photos are not kept until the learner chooses to", async () => {
    const { container } = await view();
    expect(text(container)).toContain("Off. Photos are deleted about an hour after");
  });

  it("deletes one kept photo", async () => {
    keepTwo();
    api.mockResolvedValue({ deleted: true });
    const { container } = await view();
    await click(button(container, "Delete Kettle"));
    await vi.waitFor(() => expect(text(container)).not.toContain("Kettle, kept"));
    expect(api).toHaveBeenCalledWith("deletePhoto", { key: "photos/a.jpg" });
    expect(readKeptPhotos().map((photo) => photo.label)).toEqual(["Bicycle"]);
    expect(hasConsent("save-photos")).toBe(true);
  });

  it("withdrawing consent deletes every kept photo", async () => {
    keepTwo();
    api.mockResolvedValue({ deleted: true });
    const { container } = await view();
    await click(button(container, "Stop keeping photos and delete them"));
    await vi.waitFor(() => expect(text(container)).toContain("Off."));
    expect(api.mock.calls.map(([, body]) => body.key)).toEqual(["photos/a.jpg", "photos/b.jpg"]);
    expect(readKeptPhotos()).toEqual([]);
    expect(hasConsent("save-photos")).toBe(false);
  });
});
