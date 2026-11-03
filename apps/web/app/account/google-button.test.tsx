// @vitest-environment happy-dom
import { UNDER_MIN_AGE } from "@sbi/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { button, click, mount, text } from "../lesson/dom-test";

const api = vi.hoisted(() => vi.fn());
vi.mock("../api", () => ({ api }));
vi.mock("../../env", () => ({ webEnv: { googleClientId: "test-client" } }));

// Stands in for Google's script: keeps the callback so a test can play the popup's answer.
const google = vi.hoisted(() => {
  const state: { callback?: (response: { credential: string }) => void; options?: unknown } = {};
  return {
    state,
    accounts: {
      id: {
        initialize: (options: { callback: (response: { credential: string }) => void }) => {
          state.callback = options.callback;
          state.options = options;
        },
        renderButton: () => undefined,
      },
    },
  };
});
window.google = google as unknown as Window["google"];

const { GoogleButton } = await import("./google-button");

afterEach(() => {
  document.body.replaceChildren();
  api.mockReset();
});

async function view() {
  const onSignedIn = vi.fn();
  const mounted = await mount(
    <QueryClientProvider client={new QueryClient()}>
      <GoogleButton mode="signup" onSignedIn={onSignedIn} />
    </QueryClientProvider>,
  );
  await vi.waitFor(() => expect(google.state.callback).toBeDefined());
  return { ...mounted, onSignedIn };
}

async function choose(scope: Element, label: string, value: string) {
  const field = [...scope.querySelectorAll("label")].find((item) => text(item) === label);
  const select = scope.querySelector<HTMLSelectElement>(`#${CSS.escape(field?.htmlFor ?? "")}`);
  if (!select) throw new Error(`no select labelled ${label}`);
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("GoogleButton", () => {
  it("uses Google's popup, so the page never navigates away", async () => {
    await view();
    expect(google.state.options).toMatchObject({ client_id: "test-client", ux_mode: "popup" });
  });

  it("signs a known Google user straight in", async () => {
    api.mockResolvedValue({ status: "signed-in" });
    const { onSignedIn } = await view();
    await act(async () => google.state.callback?.({ credential: "google-id-token" }));
    await vi.waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith("googleSignIn", { credential: "google-id-token" });
  });

  it("asks a new Google user their age, stopping under-13s before sending", async () => {
    api.mockImplementation(async (name: string) =>
      name === "googleSignIn"
        ? { firstName: "Grace", lastName: "Hopper", status: "needs-details" }
        : { accountId: "x" },
    );
    const { container, onSignedIn } = await view();
    await act(async () => google.state.callback?.({ credential: "google-id-token" }));
    await vi.waitFor(() => expect(text(container)).toContain("One more step"));

    await choose(container, "Age", "under-13");
    await click(button(container, "Finish"));
    expect(text(container)).toContain(UNDER_MIN_AGE);
    expect(api).not.toHaveBeenCalledWith("finishGoogleSignUp", expect.anything());

    await choose(container, "Age", "15");
    await click(button(container, "Finish"));
    await vi.waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith("finishGoogleSignUp", {
      age: 15,
      credential: "google-id-token",
      firstName: "Grace",
      lastName: "Hopper",
    });
  });
});
