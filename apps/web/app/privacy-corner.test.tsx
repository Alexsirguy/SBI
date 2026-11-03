// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { button, click, mount, text } from "./lesson/dom-test";

const api = vi.hoisted(() => vi.fn());
const pathname = vi.hoisted(() => ({ current: "/" }));
vi.mock("./api", () => ({ api }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

const { PrivacyCorner } = await import("./privacy-corner");

afterEach(() => {
  document.body.replaceChildren();
  window.localStorage.clear();
  api.mockReset();
  pathname.current = "/";
});

const view = () =>
  mount(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <PrivacyCorner />
    </QueryClientProvider>,
  );

describe("PrivacyCorner", () => {
  it("opens on a first visit and remembers being folded away", async () => {
    api.mockRejectedValue(new Error("offline"));
    const { container } = await view();
    expect(text(container)).toContain("Your privacy here");

    await click(button(container, "Hide"));
    expect(text(container)).not.toContain("Your privacy here");
    expect(window.localStorage.getItem("sbi.privacy-corner")).toBe("collapsed");
    expect(button(container, "Privacy").getAttribute("aria-expanded")).toBe("false");
  });

  it("stays folded and never asks for the account while folded", async () => {
    window.localStorage.setItem("sbi.privacy-corner", "collapsed");
    const { container } = await view();
    expect(text(container)).toBe("Privacy");
    expect(api).not.toHaveBeenCalled();
  });

  it("is left off the privacy page, which says it all at length", async () => {
    pathname.current = "/privacy";
    const { container } = await view();
    expect(container.innerHTML).toBe("");
  });
});
