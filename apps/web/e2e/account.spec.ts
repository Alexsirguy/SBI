import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./a11y";
import { mockApi } from "./mock-api";

const ADA = {
  accountId: "0192f1a0-0000-7000-8000-000000000001",
  email: "ada@example.com",
  emailVerified: false,
  firstName: "Ada",
  lastName: "Lovelace",
  linkedAt: null,
};

test("the Account link leads a signed-out learner to sign in", async ({ page }) => {
  await mockApi(page, "/account", () => ({
    json: { error: "Sign in to use your account." },
    status: 401,
  }));
  await page.goto("/");

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Account" })
    .click();

  await expect(page).toHaveURL(/\/account\/sign-in$/);
  await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();
  await expectNoAxeViolations(page);
});

test("a wrong password is reported without saying which part was wrong", async ({ page }) => {
  await mockApi(page, "/auth/sign-in", () => ({
    json: { error: "Email or password is wrong." },
    status: 401,
  }));
  await page.goto("/account/sign-in");

  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Email or password is wrong.");
});

test("under-13s are told to ask a grown-up, and nothing is sent", async ({ page }) => {
  let sent = false;
  await mockApi(page, "/auth/sign-up", () => {
    sent = true;
    return { json: ADA };
  });
  await page.goto("/account/sign-up");

  await page.getByLabel("First name").fill("Sam");
  await page.getByLabel("Last name").fill("Small");
  await page.getByLabel("Age", { exact: true }).selectOption("Under 13");
  await page.getByLabel("Email").fill("sam@example.com");
  await page.getByLabel("Password").fill("a very long phrase");
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "You need to be 13 or older",
  );
  expect(sent).toBe(false);
  await expectNoAxeViolations(page);
});

test("signing up lands on the account page, which asks to confirm the email", async ({ page }) => {
  let signedUp = false;
  await mockApi(page, "/auth/sign-up", () => {
    signedUp = true;
    return { json: ADA };
  });
  await mockApi(page, "/account", () =>
    signedUp ? { json: ADA } : { json: { error: "Sign in to use your account." }, status: 401 },
  );
  await page.goto("/account/sign-up");

  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("Lovelace");
  await page.getByLabel("Age", { exact: true }).selectOption("14");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password").fill("analytical engine notes");
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText("Signed in as Ada Lovelace (ada@example.com).")).toBeVisible();
  await expect(page.getByText("Please confirm your email.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Link this device" })).toBeDisabled();
  await expectNoAxeViolations(page);
});

test("a teacher signing up is told teaching tools switch on once the email is confirmed", async ({
  page,
}) => {
  let role: unknown;
  const teacher = { ...ADA, educatorPending: true };
  await mockApi(page, "/auth/sign-up", (body) => {
    role = (body as { role?: unknown }).role;
    return { json: teacher };
  });
  await mockApi(page, "/account", () =>
    role ? { json: teacher } : { json: { error: "Sign in to use your account." }, status: 401 },
  );
  await page.goto("/account/sign-up");

  await page.getByText("I teach or tutor").click();
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("Lovelace");
  await page.getByLabel("Age", { exact: true }).selectOption("34");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password").fill("analytical engine notes");
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page).toHaveURL(/\/account$/);
  expect(role).toBe("educator");
  await expect(page.getByText("Confirm your email to switch on teaching tools.")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("the emailed link confirms the address", async ({ page }) => {
  await mockApi(page, "/auth/verify", () => ({ json: { ok: true } }));
  await page.goto(`/account/verify?token=${"A".repeat(43)}`);
  await expect(page.getByRole("main").getByRole("status")).toContainText(
    "Your email is confirmed.",
  );
});

test("forgot password never says whether an email has an account", async ({ page }) => {
  await mockApi(page, "/auth/forgot", () => ({ json: { ok: true } }));
  await page.goto("/account/forgot");
  await expectNoAxeViolations(page);

  await page.getByLabel("Email").fill("someone@example.com");
  await page.getByRole("button", { name: "Send me a link" }).click();

  await expect(page.getByRole("main").getByRole("status")).toContainText(
    "If that email has an account",
  );
});

test("a reset link sets a new password", async ({ page }) => {
  await mockApi(page, "/auth/reset", () => ({ json: { ok: true } }));
  await page.goto(`/account/reset?token=${"A".repeat(43)}`);
  await expectNoAxeViolations(page);

  await page.getByLabel("New password").fill("a brand new phrase");
  await page.getByRole("button", { name: "Change password" }).click();

  await expect(page.getByRole("main").getByRole("status")).toContainText(
    "every device was signed out",
  );
});

test("an account can be downloaded or deleted from the account page", async ({ page }) => {
  const verified = { ...ADA, emailVerified: true };
  let deleted: unknown;
  await mockApi(page, "/account", () => ({ json: verified }));
  await mockApi(page, "/account/delete", (body) => {
    deleted = body;
    return { json: { deletedPhotos: [] } };
  });
  await page.goto("/account");
  await expect(page.getByRole("button", { name: "Download your data" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByText("Delete my account").first().click();
  await page.getByLabel("Type ada@example.com to confirm").fill("ada@example.com");
  await page.getByRole("button", { name: "Delete my account" }).click();

  await expect(page).toHaveURL(/\/account\/deleted$/);
  expect(deleted).toEqual({ email: "ada@example.com" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your account is deleted");
  await expectNoAxeViolations(page);
});
