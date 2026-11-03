// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { button, click, mount, text } from "../lesson/dom-test";

const api = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("../api", () => ({ api }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../../env", () => ({ webEnv: { apiUrl: "http://api.test" } }));

const { YourData } = await import("./your-data");
const { hasConsent, readKeptPhotos, rememberKeptPhoto, setConsent } = await import("../consent");

const KEY = "photos/0192f1a0-0000-7000-8000-000000000001.jpg";

afterEach(() => {
  document.body.replaceChildren();
  window.localStorage.clear();
  api.mockReset();
  router.replace.mockReset();
});

const view = () =>
  mount(
    <QueryClientProvider client={new QueryClient()}>
      <YourData email="ada@example.com" />
    </QueryClientProvider>,
  );

async function type(scope: Element, value: string) {
  const input = scope.querySelector<HTMLInputElement>('input[type="email"]');
  if (!input) throw new Error("no email field");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("YourData", () => {
  it("saves the export as a file and links each photo download", async () => {
    const created = vi.fn(() => "blob:export");
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() });
    api.mockResolvedValue({
      account: {},
      exportedAt: "2026-11-03T10:00:00.000Z",
      notes: [],
      photos: [{ consentVersion: "consent-1", download: "/account/photos/a.jpg", key: KEY }],
      savedLessons: [],
    });
    const { container } = await view();

    await click(button(container, "Download your data"));

    await vi.waitFor(() => expect(text(container)).toContain("Your data was saved as a file."));
    expect(created).toHaveBeenCalled();
    expect(
      container.querySelector("a[href='http://api.test/account/photos/a.jpg']"),
    ).not.toBeNull();
  });

  it("deletes only after the account's email is typed, then forgets its photos here", async () => {
    setConsent("account", true);
    rememberKeptPhoto({ key: KEY, keptAt: "2026-11-03T10:00:00.000Z", label: "Kettle" });
    api.mockResolvedValue({ deletedPhotos: [KEY] });
    const { container } = await view();

    await type(container, "someone@example.com");
    await click(button(container, "Delete my account"));
    expect(text(container)).toContain("Type the email of this account exactly");
    expect(api).not.toHaveBeenCalled();

    await type(container, "Ada@Example.com");
    await click(button(container, "Delete my account"));

    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith("/account/deleted"));
    expect(api).toHaveBeenCalledWith("deleteAccount", { email: "ada@example.com" });
    expect(readKeptPhotos()).toEqual([]);
    expect(hasConsent("account")).toBe(false);
  });
});
