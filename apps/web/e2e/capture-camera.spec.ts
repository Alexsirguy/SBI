import { expectNoAxeViolations } from "./a11y";
import { expect, test } from "@playwright/test";

test("one photo choice offers a live camera and an upload, each with an icon", async ({ page }) => {
  await page.goto("/capture");
  const choice = page.getByRole("group", { name: "Add a photo" });
  const take = choice.getByRole("button", { name: "Take a photo" });
  await expect(take.locator("svg")).toHaveCount(1);
  await expect(choice.getByText("Upload a photo").locator("svg")).toHaveCount(1);
  await expect(page.getByLabel("Upload a photo")).toHaveAttribute("type", "file");
  await expect(page.getByRole("heading", { name: "No image? Describe it instead" })).toBeVisible();
});

test("take a photo opens a live camera in the page and the snap goes through the checks", async ({
  page,
}) => {
  await page.goto("/capture");
  await page.getByRole("button", { name: "Take a photo" }).click();
  const camera = page.getByRole("region", { name: "Camera" });
  await expect(camera.getByRole("status")).toHaveText(/Camera ready/, { timeout: 15000 });
  await expect(camera.getByRole("button", { name: "Snap" })).toBeFocused();
  await expect(camera).toContainText("The live view stays on your device");
  await expectNoAxeViolations(page);

  await camera.getByRole("button", { name: "Snap" }).click();
  await expect(camera).toHaveCount(0);
  await expect(page.getByAltText("Your photo")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "Upload photo" })).toBeEnabled();
});

test("cancel and Escape close the camera and return focus", async ({ page }) => {
  await page.goto("/capture");
  const take = page.getByRole("button", { name: "Take a photo" });
  await take.click();
  const camera = page.getByRole("region", { name: "Camera" });
  await camera.getByRole("button", { name: "Cancel" }).click();
  await expect(camera).toHaveCount(0);
  await expect(take).toBeFocused();

  await take.click();
  await expect(camera).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(camera).toHaveCount(0);
  await expect(take).toBeFocused();
});

test("a refused camera explains itself and offers the camera app instead", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException("denied", "NotAllowedError"));
  });
  await page.goto("/capture");
  await page.getByRole("button", { name: "Take a photo" }).click();
  await expect(page.getByText("Camera access was not allowed")).toBeVisible();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open camera app" }).click();
  expect((await chooser).element()).toBeTruthy();
});

test("without a live camera, take a photo falls back to the device camera", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", { value: undefined });
  });
  await page.goto("/capture");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Take a photo" }).click();
  const fallback = await chooser;
  expect(await fallback.element().getAttribute("capture")).toBe("environment");
  await expect(page.getByText("so your camera app opens instead")).toBeVisible();
});
