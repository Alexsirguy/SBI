import { expect, type Page, test } from "@playwright/test";
import { expectNoAxeViolations } from "./a11y";
import {
  mockObservations,
  mockRecognition,
  mockTaxonomy,
  mockUploads,
  PHOTO_KEY,
  RESULT_ID,
  SESSION_ID,
} from "./mock-api";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const BICYCLE = {
  taxonomyId: "object.bicycle",
  label: "Bicycle",
  certainty: "likely",
  reasons: ["Two wheels", "A chain"],
  parts: [
    { taxonomyId: "object.bicycle:chain", label: "Chain" },
    { taxonomyId: "object.bicycle:gears", label: "Gears" },
  ],
};
const SWING = {
  taxonomyId: "object.swing",
  label: "Playground swing",
  certainty: "unsure",
  reasons: ["A seat on chains"],
  parts: [],
};
const MAGNET = {
  taxonomyId: "object.magnet",
  label: "Magnet",
  certainty: "unsure",
  reasons: [],
  parts: [],
};

async function uploadPhoto(page: Page) {
  await page.goto("/capture");
  await page
    .locator('input[name="upload"]')
    .setInputFiles({ buffer: tinyPng, mimeType: "image/png", name: "object.png" });
  await page.getByRole("button", { name: "Upload photo" }).click({ timeout: 15000 });
  return page.getByRole("region", { name: "What is in your photo?" });
}

test.beforeEach(async ({ page }) => {
  await mockUploads(page);
  await mockTaxonomy(page);
});

test("shows the likely object with reasons, alternatives and parts", async ({ page }) => {
  const recognition = await mockRecognition(page, {
    candidates: [BICYCLE, SWING, MAGNET],
    next: { kind: "proceed", taxonomyId: "object.bicycle" },
  });
  const photo = await uploadPhoto(page);

  const suggestions = photo.getByRole("list", { name: "What we think it is" });
  await expect(suggestions.getByRole("button")).toHaveText([
    "Bicycle",
    "Playground swing",
    "Magnet",
  ]);
  await expect(photo.getByRole("button", { name: "Bicycle" })).toHaveAccessibleDescription(
    "Likely. Two wheels. A chain.",
  );
  await expect(photo.getByRole("button", { name: "Magnet" })).toHaveAccessibleDescription(
    "Not sure.",
  );
  await expect(photo.getByRole("button", { name: "Chain" })).toBeVisible();
  await expect(photo.getByRole("status")).toHaveText(
    "Is this right? Pick the object in your photo, or tell us what it is.",
  );
  expect(recognition.requests).toEqual([{ key: PHOTO_KEY }]);
  await expectNoAxeViolations(page);
});

test("choosing an alternative records it on the recognition result", async ({ page }) => {
  const recognition = await mockRecognition(page, {
    candidates: [BICYCLE, SWING],
    next: { kind: "proceed", taxonomyId: "object.bicycle" },
  });
  const photo = await uploadPhoto(page);

  await photo.getByRole("button", { name: "Playground swing" }).click();
  await expect(photo.getByRole("heading", { name: "Start this lesson?" })).toBeFocused();
  await photo.getByRole("button", { name: "Start lesson" }).click();

  await expect(photo.getByText("Starting lesson: Playground swing.")).toBeFocused();
  await expect
    .poll(() => recognition.selections)
    .toEqual([{ resultId: RESULT_ID, selection: { kind: "object", taxonomyId: "object.swing" } }]);
});

test("tapping a part starts a lesson about that part", async ({ page }) => {
  const recognition = await mockRecognition(page, {
    candidates: [BICYCLE],
    next: { kind: "proceed", taxonomyId: "object.bicycle" },
  });
  const photo = await uploadPhoto(page);

  await photo.getByRole("button", { name: "Chain" }).click();
  await expect(photo).toContainText("Lesson about: Bicycle: chain.");
  await photo.getByRole("button", { name: "Start lesson" }).click();

  await expect
    .poll(() => recognition.selections)
    .toEqual([
      { resultId: RESULT_ID, selection: { kind: "object", taxonomyId: "object.bicycle:chain" } },
    ]);
});

test("the learner's own words are recorded as a correction", async ({ page }) => {
  const recognition = await mockRecognition(page, {
    candidates: [SWING],
    next: { kind: "ask", question: "Is it a playground swing?", options: [SWING] },
  });
  const photo = await uploadPhoto(page);
  await expect(photo.getByRole("status")).toHaveText("Is it a playground swing?");

  await photo.getByLabel("Not right? Tell us what it is").fill("bike");
  await photo.getByLabel("Not right? Tell us what it is").press("Enter");
  await expect(photo.getByRole("status")).toHaveText("1 match for “bike”.");
  await photo.getByRole("button", { name: "Bicycle" }).click();
  await photo.getByRole("button", { name: "Start lesson" }).click();

  await expect
    .poll(() => recognition.selections)
    .toEqual([
      { resultId: RESULT_ID, selection: { kind: "free-text", text: "bike" } },
      { resultId: RESULT_ID, selection: { kind: "object", taxonomyId: "object.bicycle" } },
    ]);
});

test("an unsure learner can learn about the shared category, with the assumption stated", async ({
  page,
}) => {
  const fallback = {
    taxonomyId: "category.heating",
    label: "Heating and cooking",
    alternatives: ["Teapot", "Coffee pot"],
    assumption:
      "We could not tell if this is a teapot or a coffee pot, so this lesson covers heating and cooking, which is true of both.",
  };
  const recognition = await mockRecognition(page, {
    candidates: [],
    next: {
      kind: "ask",
      question: "Is it a teapot or a coffee pot?",
      options: [
        { taxonomyId: "object.teapot", label: "Teapot" },
        { taxonomyId: "object.coffee-pot", label: "Coffee pot" },
      ],
      fallback,
    },
  });
  const photo = await uploadPhoto(page);

  await expect(
    photo.getByRole("list", { name: "Matching objects" }).getByRole("button"),
  ).toHaveText(["Teapot", "Coffee pot"]);
  await photo.getByRole("button", { name: "Not sure? Learn about heating and cooking" }).click();
  await expect(photo).toContainText(fallback.assumption);
  await expectNoAxeViolations(page);
  await photo.getByRole("button", { name: "Start lesson" }).click();

  await expect
    .poll(() => recognition.selections)
    .toEqual([
      { resultId: RESULT_ID, selection: { kind: "object", taxonomyId: "category.heating" } },
    ]);
});

test("a retake reuses the session so results stay grouped", async ({ page }) => {
  const recognition = await mockRecognition(page, {
    candidates: [BICYCLE],
    next: { kind: "proceed", taxonomyId: "object.bicycle" },
  });
  await uploadPhoto(page);
  await expect(page.getByRole("button", { name: "Bicycle" })).toBeVisible();

  await page.getByRole("button", { name: "Retake or choose another" }).click();
  await page
    .locator('input[name="upload"]')
    .setInputFiles({ buffer: tinyPng, mimeType: "image/png", name: "again.png" });
  await page.getByRole("button", { name: "Upload photo" }).click({ timeout: 15000 });

  await expect
    .poll(() => recognition.requests)
    .toEqual([{ key: PHOTO_KEY }, { key: PHOTO_KEY, sessionId: SESSION_ID }]);
});

test("suggestions and parts work from the keyboard alone", async ({ page }) => {
  const recognition = await mockRecognition(page, {
    candidates: [BICYCLE, SWING],
    next: { kind: "proceed", taxonomyId: "object.bicycle" },
  });
  const photo = await uploadPhoto(page);

  await photo.getByRole("button", { name: "Bicycle" }).focus();
  await page.keyboard.press("Tab");
  await expect(photo.getByRole("button", { name: "Playground swing" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(photo.getByRole("button", { name: "Chain" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(photo.getByRole("heading", { name: "Start this lesson?" })).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");

  await expect(photo.getByText("Starting lesson: Bicycle: chain.")).toBeFocused();
  await expect.poll(() => recognition.selections).toHaveLength(1);
});

test("look-alikes the catalog cannot teach yet are offered as corrections", async ({ page }) => {
  const sent = await mockObservations(page);
  const recognition = await mockRecognition(page, {
    candidates: [{ ...BICYCLE, reasons: ["two spoked wheels"] }],
    otherLabels: ["Tricycle", "Motorcycle"],
    next: { kind: "proceed", taxonomyId: "object.bicycle" },
  });
  const photo = await uploadPhoto(page);

  await expect(photo.getByRole("button", { name: "Bicycle" })).toHaveAccessibleDescription(
    "Likely. Two spoked wheels.",
  );
  const others = photo.getByRole("list", { name: "Or something we cannot teach yet:" });
  await expect(others.getByRole("button")).toHaveText(["Tricycle", "Motorcycle"]);
  await expectNoAxeViolations(page);

  await others.getByRole("button", { name: "Tricycle" }).click();
  await expect(photo.getByRole("status")).toContainText("No matches for “Tricycle”");
  await expect(photo.getByLabel("Not right? Tell us what it is")).toHaveValue("Tricycle");
  await expect(
    photo.getByRole("button", { name: "Can't find it? Tell us what you notice" }),
  ).toBeVisible();
  await expect
    .poll(() => recognition.selections)
    .toEqual([{ resultId: RESULT_ID, selection: { kind: "free-text", text: "Tricycle" } }]);
  expect(sent).toEqual([]);
});
