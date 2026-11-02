// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { button, click, mount, text } from "../lesson/dom-test";

const api = vi.hoisted(() => vi.fn());
vi.mock("../api", () => ({ api }));

const { KeepPhoto } = await import("./keep-photo");
const { hasConsent, readKeptPhotos } = await import("../consent");

afterEach(() => {
  document.body.replaceChildren();
  window.localStorage.clear();
  api.mockReset();
});

const view = () =>
  mount(
    <QueryClientProvider client={new QueryClient()}>
      <KeepPhoto photoKey="photos/a.jpg" label="Kettle" />
    </QueryClientProvider>,
  );

describe("KeepPhoto", () => {
  it("explains the choice before keeping anything", async () => {
    const { container } = await view();
    await click(button(container, "Keep this photo"));
    expect(text(container)).toContain("never used to train AI");
    expect(api).not.toHaveBeenCalled();
    await click(button(container, "Not now"));
    expect(hasConsent("save-photos")).toBe(false);
    expect(api).not.toHaveBeenCalled();
  });

  it("keeps the photo with the consent version and lists it on this device", async () => {
    api.mockResolvedValue({ kept: true });
    const { container } = await view();
    await click(button(container, "Keep this photo"));
    await click(button(container, "Keep it"));
    await vi.waitFor(() => expect(text(container)).toContain("Photo kept"));
    expect(api).toHaveBeenCalledWith("keepPhoto", {
      key: "photos/a.jpg",
      consentVersion: "consent-1",
    });
    expect(hasConsent("save-photos")).toBe(true);
    expect(readKeptPhotos().map((photo) => photo.key)).toEqual(["photos/a.jpg"]);
  });
});
