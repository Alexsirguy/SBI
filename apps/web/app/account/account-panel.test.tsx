// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../api-client";
import { button, click, mount, text } from "../lesson/dom-test";

const api = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("../api", () => ({ api }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../../env", () => ({ webEnv: { apiUrl: "http://api.test" } }));

const { AccountPanel } = await import("./account-panel");
const { hasConsent, rememberKeptPhoto, setConsent } = await import("../consent");

const ADA = {
  accountId: "0192f1a0-0000-7000-8000-000000000001",
  email: "ada@example.com",
  emailVerified: true,
  firstName: "Ada",
  lastName: "Lovelace",
  linkedAt: null as string | null,
};

afterEach(() => {
  document.body.replaceChildren();
  window.localStorage.clear();
  api.mockReset();
  router.replace.mockReset();
});

const view = () =>
  mount(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AccountPanel />
    </QueryClientProvider>,
  );

// Buttons render before the account loads; clicking one early would do nothing.
const enabled = (scope: Element, name: string) =>
  vi.waitFor(() => {
    const found = button(scope, name);
    expect(found.disabled).toBe(false);
    return found;
  });

describe("AccountPanel", () => {
  it("sends a signed-out learner to the sign-in page", async () => {
    api.mockRejectedValue(new ApiRequestError("Sign in to use your account.", 401));
    await view();
    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith("/account/sign-in"));
  });

  it("asks for a confirmed email before linking, and can resend the link", async () => {
    api.mockImplementation(async (name: string) =>
      name === "getAccount" ? { ...ADA, emailVerified: false } : { ok: true },
    );
    const { container } = await view();
    await vi.waitFor(() => expect(text(container)).toContain("Please confirm your email."));
    expect(button(container, "Link this device").disabled).toBe(true);

    await click(button(container, "Send the link again"));
    await vi.waitFor(() => expect(text(container)).toContain("Link sent"));
    expect(api).toHaveBeenCalledWith("resendVerification", {});
  });

  it("links this device only when asked, sending the consent and kept photos", async () => {
    rememberKeptPhoto({ key: "photos/a.jpg", label: "Kettle", keptAt: "2026-11-02T10:00:00.000Z" });
    let linkedAt: string | null = null;
    api.mockImplementation(async (name: string) => {
      if (name === "getAccount") return { ...ADA, linkedAt };
      linkedAt = "2026-11-02T10:00:00.000Z";
      return { accountId: ADA.accountId, linkedPhotos: 1 };
    });
    const { container } = await view();
    const link = await enabled(container, "Link this device");
    expect(text(container)).toContain("Signed in as Ada Lovelace (ada@example.com).");
    expect(hasConsent("account")).toBe(false);

    await click(link);

    await vi.waitFor(() => expect(text(container)).toContain("This device is linked."));
    expect(api).toHaveBeenCalledWith("linkAccount", {
      consent: expect.objectContaining({ choices: expect.objectContaining({ account: true }) }),
      photoKeys: ["photos/a.jpg"],
    });
    expect(hasConsent("account")).toBe(true);
  });

  it("takes the choice back if linking fails", async () => {
    api.mockImplementation(async (name: string) => {
      if (name === "getAccount") return ADA;
      throw new Error("Linking failed.");
    });
    const { container } = await view();
    await click(await enabled(container, "Link this device"));
    await vi.waitFor(() => expect(text(container)).toContain("Linking failed."));
    expect(hasConsent("account")).toBe(false);
  });

  it("unlinks and withdraws the choice", async () => {
    setConsent("account", true);
    let linkedAt: string | null = "2026-11-02T10:00:00.000Z";
    api.mockImplementation(async (name: string) => {
      if (name === "getAccount") return { ...ADA, linkedAt };
      linkedAt = null;
      return { unlinkedPhotos: 1 };
    });
    const { container } = await view();
    await click(await enabled(container, "Unlink this device"));
    await vi.waitFor(() => expect(text(container)).toContain("Off. Linking"));
    expect(hasConsent("account")).toBe(false);
  });

  it("signs out and returns to the sign-in page", async () => {
    api.mockImplementation(async (name: string) => (name === "getAccount" ? ADA : { ok: true }));
    const { container } = await view();
    await click(await enabled(container, "Sign out"));
    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith("/account/sign-in"));
    expect(api).toHaveBeenCalledWith("signOut", {});
  });
});
