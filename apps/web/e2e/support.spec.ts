import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./a11y";
import { mockApi } from "./mock-api";

test("the support map is reachable from the footer and says what we cover", async ({ page }) => {
  await mockApi(page, "/taxonomy/support-map?", () => ({
    json: {
      catalogueObjects: 1,
      categories: [
        {
          id: "category.fungi",
          label: "Fungi",
          objects: [
            { curated: true, id: "object.mushroom", label: "Mushroom", safetyNotice: true },
          ],
        },
      ],
      onDemandSubjects: 7,
    },
  }));
  await page.goto("/");

  await page
    .getByRole("navigation", { name: "Footer" })
    .getByRole("link", { name: "What we cover" })
    .click();

  await expect(page).toHaveURL(/\/support$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What we cover");
  await expect(page.getByText("7 subjects outside our catalogue")).toBeVisible();
  await expect(page.getByRole("region", { name: "Fungi" })).toContainText("safety notice");
  await expectNoAxeViolations(page);
});
