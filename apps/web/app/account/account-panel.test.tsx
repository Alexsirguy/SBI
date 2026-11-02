// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { button, click, mount, text } from "../lesson/dom-test";

const api = vi.hoisted(() => vi.fn());
const session = vi.hoisted(() => ({
  finishSignIn: vi.fn(),
  signIn: vi.fn(async () => undefined),
  signOut: vi.fn(async () => undefined),
  signedIn: vi.fn(async () => true),
  token: vi.fn(async () => "jwt"),
}));
const holder = vi.hoisted(() => ({ session: null as unknown }));
vi.mock("../api", () => ({ api }));
vi.mock("./account-session", () => ({
  get accountSession() {
    return holder.session;
  },
}));

const { AccountPanel } = await import("./account-panel");
const { hasConsent, rememberKeptPhoto, setConsent } = await import("../consent");

const ACCOUNT = {
  accountId: "0192f1a0-0000-7000-8000-000000000001",
  createdAt: "2026-11-02T10:00:00.000Z",
};

afterEach(() => {
  document.body.replaceChildren();
  window.localStorage.clear();
  api.mockReset();
  holder.session = null;
});

// Buttons render disabled until the account loads; clicking one early would do nothing.
const enabled = (scope: Element, name: string) =>
  vi.waitFor(() => {
    const found = button(scope, name);
    expect(found.disabled).toBe(false);
    return found;
  });

const view = () =>
  mount(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AccountPanel />
    </QueryClientProvider>,
  );

describe("AccountPanel", () => {
  it("explains accounts are unavailable when no provider is configured", async () => {
    const { container } = await view();
    expect(text(container)).toContain("Accounts are not available on this site.");
  });

  it("offers sign-in, promising only an id is kept", async () => {
    holder.session = { ...session, signedIn: vi.fn(async () => false) };
    const { container } = await view();
    await vi.waitFor(() => expect(text(container)).toContain("not your name or email"));
    await click(button(container, "Sign in or create an account"));
    expect((holder.session as typeof session).signIn).toHaveBeenCalledWith("/account");
  });

  it("links this device only when asked, sending the consent and kept photos", async () => {
    holder.session = session;
    rememberKeptPhoto({ key: "photos/a.jpg", label: "Kettle", keptAt: ACCOUNT.createdAt });
    let linkedAt: string | null = null;
    api.mockImplementation(async (name: string) => {
      if (name === "getAccount") return { ...ACCOUNT, linkedAt };
      linkedAt = ACCOUNT.createdAt;
      return { accountId: ACCOUNT.accountId, linkedPhotos: 1 };
    });
    const { container } = await view();
    const link = await enabled(container, "Link this device");
    expect(text(container)).toContain("Off. Linking ties the photo");
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
    holder.session = session;
    api.mockImplementation(async (name: string) => {
      if (name === "getAccount") return { ...ACCOUNT, linkedAt: null };
      throw new Error("Linking failed.");
    });
    const { container } = await view();
    await click(await enabled(container, "Link this device"));
    await vi.waitFor(() => expect(text(container)).toContain("Linking failed."));
    expect(hasConsent("account")).toBe(false);
  });

  it("unlinks and withdraws the choice", async () => {
    holder.session = session;
    setConsent("account", true);
    let linkedAt: string | null = ACCOUNT.createdAt;
    api.mockImplementation(async (name: string) => {
      if (name === "getAccount") return { ...ACCOUNT, linkedAt };
      linkedAt = null;
      return { unlinkedPhotos: 1 };
    });
    const { container } = await view();
    await click(await enabled(container, "Unlink this device"));
    await vi.waitFor(() => expect(text(container)).toContain("Off. Linking"));
    expect(hasConsent("account")).toBe(false);
  });
});
