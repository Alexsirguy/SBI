// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { button, click, mount, text } from "../lesson/dom-test";

const api = vi.hoisted(() => vi.fn());
vi.mock("../api", () => ({ api }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { KeepPhoto } = await import("./keep-photo");
const { PathwayProvider } = await import("../pathway/provider");
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

  it("keeps a child's photo only after a grown-up check", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // 6 × 6
    api.mockResolvedValue({ kept: true });
    const { container } = await mount(
      <QueryClientProvider client={new QueryClient()}>
        <PathwayProvider initial="child">
          <KeepPhoto photoKey="photos/a.jpg" label="Kettle" />
        </PathwayProvider>
      </QueryClientProvider>,
    );
    await click(button(container, "Keep this photo"));
    await click(button(container, "Keep it"));
    expect(text(container)).toContain("Ask a grown-up");
    expect(api).not.toHaveBeenCalled();

    const input = container.querySelector<HTMLInputElement>(".grown-up-gate input");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(input, "36");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click(button(container, "Check"));

    await vi.waitFor(() => expect(api).toHaveBeenCalledWith("keepPhoto", expect.anything()));
    vi.restoreAllMocks();
  });
});
