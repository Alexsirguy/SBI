// @vitest-environment happy-dom
import { UNDER_MIN_AGE } from "@sbi/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { button, click, mount, text } from "../../lesson/dom-test";

const api = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("../../api", () => ({ api }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../../../env", () => ({ webEnv: { googleClientId: null } }));

const { SignUpForm } = await import("./sign-up-form");

afterEach(() => {
  document.body.replaceChildren();
  api.mockReset();
  router.replace.mockReset();
});

const view = () =>
  mount(
    <QueryClientProvider client={new QueryClient()}>
      <SignUpForm />
    </QueryClientProvider>,
  );

// React tracks input values itself, so tests set them the way a browser does.
async function type(scope: Element, label: string, value: string) {
  const field = [...scope.querySelectorAll("label")].find((item) => text(item) === label);
  const input = scope.querySelector<HTMLInputElement>(`#${CSS.escape(field?.htmlFor ?? "")}`);
  if (!input) throw new Error(`no field labelled ${label}`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
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

async function pick(scope: Element, role: string) {
  const radio = scope.querySelector<HTMLInputElement>(`input[name="role"][value="${role}"]`);
  if (!radio) throw new Error(`no ${role} choice`);
  await act(async () => radio.click());
}

async function fill(scope: Element, age: string) {
  await type(scope, "First name", "Ada");
  await type(scope, "Last name", "Lovelace");
  await choose(scope, "Age", age);
  await type(scope, "Email", "ada@example.com");
  await type(scope, "Password", "analytical engine notes");
}

describe("SignUpForm", () => {
  it("stops under-13s on the device, sending nothing", async () => {
    const { container } = await view();
    await fill(container, "under-13");
    await click(button(container, "Create Account"));

    expect(text(container)).toContain(UNDER_MIN_AGE);
    expect(api).not.toHaveBeenCalled();
  });

  it("shows each problem beside its field", async () => {
    const { container } = await view();
    await type(container, "Email", "not-an-email");
    await type(container, "Password", "short");
    await click(button(container, "Create Account"));

    expect(text(container)).toContain("Choose your age.");
    expect(text(container)).toContain("Enter a valid email address.");
    expect(text(container)).toContain("Use at least 10 characters.");
    expect(api).not.toHaveBeenCalled();
  });

  it("makes the account and goes to the account page", async () => {
    api.mockResolvedValue({
      accountId: "0192f1a0-0000-7000-8000-000000000001",
      email: "ada@example.com",
      emailVerified: false,
      firstName: "Ada",
      lastName: "Lovelace",
      linkedAt: null,
    });
    const { container } = await view();
    await fill(container, "14");
    await click(button(container, "Create Account"));

    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith("/account"));
    expect(api).toHaveBeenCalledWith("signUp", {
      age: 14,
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      password: "analytical engine notes",
      role: "learner",
    });
  });

  it("stops an under-18 choosing teaching tools on the device", async () => {
    const { container } = await view();
    await pick(container, "educator");
    await fill(container, "16");
    await click(button(container, "Create Account"));

    expect(text(container)).toContain("Teaching tools are for adults aged 18 or over.");
    expect(api).not.toHaveBeenCalled();
  });

  it('asks for teaching tools when an adult chooses "I teach or tutor"', async () => {
    api.mockResolvedValue({});
    const { container } = await view();
    await pick(container, "educator");
    await fill(container, "34");
    await click(button(container, "Create Account"));

    await vi.waitFor(() =>
      expect(api).toHaveBeenCalledWith("signUp", expect.objectContaining({ role: "educator" })),
    );
  });

  it("shows the server's answer when the email is taken", async () => {
    api.mockRejectedValue(new Error("An account already uses that email. Sign in instead."));
    const { container } = await view();
    await fill(container, "14");
    await click(button(container, "Create Account"));
    await vi.waitFor(() => expect(text(container)).toContain("already uses that email"));
  });
});
