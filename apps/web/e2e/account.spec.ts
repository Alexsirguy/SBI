import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./a11y";

// CI builds without a sign-in provider, which is also how most deployments start (ADR 0020).
test("the account page explains accounts are optional and unavailable without a provider", async ({
  page,
}) => {
  await page.goto("/account");

  await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
  await expect(page.getByText("Accounts are not available on this site.")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Account" }),
  ).toHaveCount(0);
  await expectNoAxeViolations(page);
});
