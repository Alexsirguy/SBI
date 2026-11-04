// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { click, mount, text } from "./lesson/dom-test";

const api = vi.hoisted(() => vi.fn());
const pathway = vi.hoisted(() => ({ current: undefined as string | undefined }));
vi.mock("./api", () => ({ api }));
vi.mock("./pathway/provider", () => ({
  usePathway: () => ({ pathway: pathway.current, choose: () => undefined }),
}));

const { ConsentRequests } = await import("./consent-requests");
const { consentChoice, readKeptPhotos, rememberKeptPhoto, setConsent } = await import("./consent");

afterEach(() => {
  document.body.replaceChildren();
  window.localStorage.clear();
  api.mockReset();
  pathway.current = undefined;
});

const signedOut = (name: string) => {
  if (name === "getAccount") return Promise.reject(new Error("offline"));
  return Promise.resolve({ deleted: true });
};

const view = () =>
  mount(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ConsentRequests />
    </QueryClientProvider>,
  );

function answer(container: Element, request: string, choice: "Accept" | "Decline") {
  const group = [...container.querySelectorAll('[role="group"]')].find((item) => {
    const title = document.getElementById(item.getAttribute("aria-labelledby") ?? "");
    return title ? text(title) === request : false;
  });
  const found = [...(group?.querySelectorAll("button") ?? [])].find((b) => text(b) === choice);
  if (!found) throw new Error(`no ${choice} for ${request}`);
  return found;
}

function button(container: Element, name: string) {
  const found = [...container.querySelectorAll("button")].find((item) => text(item) === name);
  if (!found) throw new Error(`no button named ${name}`);
  return found;
}

describe("ConsentRequests", () => {
  it("asks for all five, each unanswered and so off", async () => {
    api.mockImplementation(signedOut);
    const { container } = await view();
    expect(container.querySelectorAll('[role="group"]')).toHaveLength(5);
    expect(text(container).match(/Not answered, so off\./g)).toHaveLength(5);
    expect(container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
  });

  it("never asks the child pathway for usage statistics", async () => {
    api.mockImplementation(signedOut);
    pathway.current = "child";
    const { container } = await view();
    expect(container.querySelectorAll('[role="group"]')).toHaveLength(4);
    expect(text(container)).not.toContain("Share usage statistics");
  });

  it("declining usage statistics forgets this visit's ID", async () => {
    api.mockImplementation(signedOut);
    setConsent("usage-statistics", true);
    window.sessionStorage.setItem("sbi.visit", "visit-1");
    const { container } = await view();
    await click(answer(container, "Share usage statistics", "Decline"));
    await vi.waitFor(() => expect(consentChoice("usage-statistics")).toBe(false));
    expect(window.sessionStorage.getItem("sbi.visit")).toBeNull();
  });

  it("records each answer on its own, never bundled", async () => {
    api.mockImplementation(signedOut);
    const { container } = await view();
    await click(answer(container, "Take part in research", "Accept"));
    await vi.waitFor(() => expect(consentChoice("research")).toBe(true));
    expect(consentChoice("model-improvement")).toBeUndefined();
    expect(answer(container, "Take part in research", "Accept").getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("declining photos deletes the ones already kept", async () => {
    api.mockImplementation(signedOut);
    setConsent("save-photos", true);
    rememberKeptPhoto({ key: "photos/a.jpg", label: "Kettle", keptAt: "2026-11-02T10:00:00.000Z" });
    const { container } = await view();
    expect(text(container)).toContain("Declining deletes the 1 you kept.");
    await click(answer(container, "Keep photos I choose to keep", "Decline"));
    await vi.waitFor(() => expect(consentChoice("save-photos")).toBe(false));
    expect(api).toHaveBeenCalledWith("deletePhoto", { key: "photos/a.jpg" });
    expect(readKeptPhotos()).toEqual([]);
  });

  it("accept all and decline all answer every request", async () => {
    api.mockImplementation(signedOut);
    const { container } = await view();
    await click(button(container, "Accept all"));
    await vi.waitFor(() => expect(consentChoice("research")).toBe(true));
    expect(consentChoice("account")).toBe(true);
    await click(button(container, "Decline all"));
    await vi.waitFor(() => expect(consentChoice("research")).toBe(false));
    expect(consentChoice("save-photos")).toBe(false);
  });

  it("links a signed-in, confirmed account when linking is accepted", async () => {
    api.mockImplementation((name: string) =>
      name === "getAccount"
        ? Promise.resolve({ accountId: "a", emailVerified: true, linkedAt: null })
        : Promise.resolve({ accountId: "a", linkedPhotos: 0 }),
    );
    const { container } = await view();
    await vi.waitFor(() => expect(text(container)).not.toContain("It applies once you sign in."));
    await click(answer(container, "Link this device to my account", "Accept"));
    await vi.waitFor(() => expect(consentChoice("account")).toBe(true));
    expect(api).toHaveBeenCalledWith(
      "linkAccount",
      expect.objectContaining({ photoKeys: [], consent: expect.anything() }),
    );
  });

  it("a child's yes waits for a grown-up, but a no does not", async () => {
    api.mockImplementation(signedOut);
    pathway.current = "child";
    const { container } = await view();
    await click(answer(container, "Help improve lessons", "Decline"));
    await vi.waitFor(() => expect(consentChoice("model-improvement")).toBe(false));
    await click(answer(container, "Help improve lessons", "Accept"));
    expect(text(container)).toContain("Accepting lets us keep or use more");
    expect(consentChoice("model-improvement")).toBe(false);
  });
});
