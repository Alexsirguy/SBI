import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator } from "@playwright/test";
import { GALLERY_FIXTURES } from "@sbi/visuals";
import { expectNoAxeViolations } from "./a11y";
import { mockPlaygrounds } from "./mock-api";
import { emulateTier } from "./tiers";

// A measurement for the #92 report, not a regression test: run with VISUAL_BUDGETS=1.
test.skip(!process.env.VISUAL_BUDGETS, "set VISUAL_BUDGETS=1 to measure load budgets");
test.use({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2 });
test.describe.configure({ mode: "serial" });

const TAP: Record<string, string> = { mechanism: "See it in action", process: "Show the diagram" };
const DRAWN: Record<string, (figure: Locator) => Locator> = {
  mechanism: (figure) => figure.locator("canvas"),
  molecule: (figure) => figure.locator(".visual-molecule__view canvas"),
  process: (figure) => figure.locator(".visual-process svg"),
  graph: (figure) => figure.locator(".visual-graph svg"),
  playground: (figure) => figure.locator("iframe.visual-playground"),
};

const results: { kind: string; firstDrawMs: number; kilobytes: number; loadsOnTap: boolean }[] = [];

for (const manifest of GALLERY_FIXTURES) {
  test(`${manifest.kind} on a slow phone`, async ({ page, context }) => {
    test.setTimeout(180_000);
    await mockPlaygrounds(page);
    const cdp = await emulateTier(context, page, "low");
    let bytes = 0;
    cdp.on("Network.loadingFinished", (event) => (bytes += event.encodedDataLength));

    await page.goto(`/visuals?kind=${manifest.kind}`);
    const figure = page.getByRole("figure", { name: manifest.alt });
    await expect(figure).toBeVisible({ timeout: 120_000 });
    const tap = TAP[manifest.kind];
    // Light kinds draw as the page loads, so their clock starts with the figure on screen.
    const start = Date.now();
    const before = bytes;
    if (tap) await figure.getByRole("button", { name: tap }).click();
    await expect(DRAWN[manifest.kind]?.(figure) ?? figure).toBeVisible({ timeout: 120_000 });
    results.push({
      kind: manifest.kind,
      firstDrawMs: Date.now() - start,
      kilobytes: Math.round((bytes - before) / 1024),
      loadsOnTap: Boolean(tap),
    });
    await expectNoAxeViolations(page);
  });
}

test.afterAll(() => {
  if (results.length === 0) return;
  const file = join(
    import.meta.dirname,
    `../../../docs/research/visuals/load-budgets-${new Date().toISOString().slice(0, 10)}.json`,
  );
  writeFileSync(
    file,
    `${JSON.stringify({ device: "360×740 @2x, 4× CPU, Slow 4G, cold cache", results }, null, 2)}\n`,
  );
});
