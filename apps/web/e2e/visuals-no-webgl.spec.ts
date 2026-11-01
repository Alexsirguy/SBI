import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./a11y";
import { mockPlaygrounds } from "./mock-api";

// Its own file, because a browser without WebGL needs its own launch.
test.use({ launchOptions: { args: ["--disable-webgl", "--disable-3d-apis"] } });

test.beforeEach(async ({ page }) => {
  await mockPlaygrounds(page);
});

test("shows the text for 3D kinds and still draws the 2D ones", async ({ page }) => {
  await page.goto("/visuals");
  const engine = page.getByRole("figure", { name: /piston engine/ });
  await expect(engine).toContainText("Burning fuel pushes the piston down");
  await expect(engine.getByRole("button", { name: "See it in action" })).toHaveCount(0);
  const water = page.getByRole("figure", { name: /water molecule/ });
  await expect(water).toContainText("Water is one oxygen atom");
  await expect(water.locator("canvas")).toHaveCount(0);
  const graph = page.getByRole("figure", { name: /Water temperature in a kettle/ });
  await expect(graph.locator(".visual-graph svg")).toBeVisible();
  await expectNoAxeViolations(page);
});
