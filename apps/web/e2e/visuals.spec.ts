import { expect, test } from "@playwright/test";
import { GALLERY_FIXTURES } from "@sbi/visuals";
import { expectNoAxeViolations } from "./a11y";

const DRAWN = new Set(["graph", "process", "mechanism", "molecule"]);

test.describe("visual gallery", () => {
  test("shows every kind, and the text fallback for kinds not drawn yet", async ({ page }) => {
    await page.goto("/visuals");
    for (const manifest of GALLERY_FIXTURES) {
      const figure = page.getByRole("figure", { name: manifest.alt });
      await expect(figure).toBeVisible();
      if (!DRAWN.has(manifest.kind)) await expect(figure).toContainText(manifest.fallback.text);
    }
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expectNoAxeViolations(page);
  });

  test("draws a graph whose sliders change the readout and the line", async ({ page }) => {
    await page.goto("/visuals");
    const graph = page.getByRole("figure", { name: /Water temperature over time/ });
    await expect(graph.locator(".visual-graph svg path").first()).toBeVisible();
    await expect(graph.locator("dd output")).toHaveText("168 s");

    const before = await graph.locator(".visual-graph svg").innerHTML();
    const power = graph.getByRole("slider", { name: "Heater power" });
    await power.focus();
    for (let i = 0; i < 10; i += 1) await page.keyboard.press("ArrowLeft");
    await expect(power).toHaveAttribute("aria-valuetext", "1,000 W");
    await expect(graph.locator("dd output")).toHaveText("335 s");
    await expect.poll(() => graph.locator(".visual-graph svg").innerHTML()).not.toBe(before);
  });

  test("loads the process diagram only when asked for", async ({ page }) => {
    await page.goto("/visuals");
    const process = page.getByRole("figure", { name: /Photosynthesis/ });
    await expect(process).toContainText("Leaves take in light");
    await expect(process.locator("svg")).toHaveCount(0);

    await process.getByRole("button", { name: "Show the diagram" }).click();
    await expect(process.getByRole("img", { name: /Photosynthesis/ })).toBeVisible();
    await expect(process).toContainText("Oxygen into the air");
    await expectNoAxeViolations(page);
  });

  test("runs the engine only when asked, and lets the learner pause it", async ({ page }) => {
    await page.goto("/visuals");
    const engine = page.getByRole("figure", { name: /piston engine/ });
    await expect(engine.locator("canvas")).toHaveCount(0);

    await engine.getByRole("button", { name: "See it in action" }).click();
    await expect(engine.getByRole("img", { name: /piston engine/ })).toBeVisible();
    const pause = engine.getByRole("button", { name: "Pause" });
    await expect(pause).toHaveAttribute("aria-pressed", "true");
    await pause.click();
    await expect(engine.getByRole("button", { name: "Play" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(engine.getByRole("button", { name: "Step forward" })).toBeVisible();
    await expect(engine.locator("dd output")).toHaveText("38.2 rpm");
    await expectNoAxeViolations(page);
  });

  test("starts the engine still when the learner prefers less motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/visuals");
    const engine = page.getByRole("figure", { name: /piston engine/ });
    await engine.getByRole("button", { name: "See it in action" }).click();
    await expect(engine.getByRole("button", { name: "Play" })).toBeVisible();
    await expect(engine.getByRole("button", { name: "Step forward" })).toBeVisible();
  });

  test("turns the engine, pulls it apart and points at a part from the keyboard", async ({
    page,
  }) => {
    await page.goto("/visuals");
    const engine = page.getByRole("figure", { name: /piston engine/ });
    await engine.getByRole("button", { name: "See it in action" }).click();
    await engine.getByRole("button", { name: "Pause" }).click();

    const canvas = engine.locator("canvas");
    const before = await canvas.screenshot();
    await engine.getByRole("button", { name: "Turn right" }).click();
    await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(false);

    const apart = engine.getByRole("slider", { name: "Pull the parts apart" });
    await apart.focus();
    await page.keyboard.press("End");
    await expect(apart).toHaveAttribute("aria-valuetext", "100%");

    const piston = engine.getByRole("button", { name: "Piston" });
    await piston.press("Enter");
    await expect(piston).toHaveAttribute("aria-pressed", "true");
    await expect(engine.locator(".visual-3d__marker--on")).toHaveText("1");
    await expectNoAxeViolations(page);
  });

  test("draws the water molecule from PubChem's structure, turning unless asked not to", async ({
    page,
  }) => {
    await page.goto("/visuals");
    const water = page.getByRole("figure", { name: /water molecule/ });
    await expect(
      water.getByRole("img", { name: "3D model of Water" }).locator("canvas"),
    ).toBeVisible();
    await expect(water).toContainText("PubChem (CID 962)");
    const turn = water.getByRole("button", { name: "Stop turning" });
    await expect(turn).toHaveAttribute("aria-pressed", "true");
    await turn.click();
    await expect(water.getByRole("button", { name: "Turn" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expectNoAxeViolations(page);
  });
});
