import { expect, type Page, test } from "@playwright/test";
import {
  MERRILL_VISUAL_ID,
  SAMPLE_MERRILL_LESSON,
  SAMPLE_MERRILL_MANIFEST,
  SAMPLE_MERRILL_VISUALS,
} from "../app/lesson/sample-merrill-lesson";
import { sseFrames } from "../app/lesson/sample-lesson";
import { expectNoAxeViolations } from "./a11y";
import { mockLesson } from "./mock-api";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const LESSON_URL = "/lesson?taxonomyId=object.acoustic-guitar&label=Guitar";
const CORS = { "access-control-allow-origin": "*" };

const FULL = sseFrames([
  { type: "progress", data: { stage: "drafting", message: "Writing the lesson." } },
  { type: "lesson", data: SAMPLE_MERRILL_LESSON },
  { type: "visuals", data: SAMPLE_MERRILL_VISUALS },
]);

async function mockManifest(page: Page, status = 200) {
  await page.route(
    (url) => url.href.startsWith(`${API_URL}/visuals?`) && url.href.includes(MERRILL_VISUAL_ID),
    (route) =>
      route.fulfill({
        headers: CORS,
        status,
        json: status === 200 ? SAMPLE_MERRILL_MANIFEST : { error: "Not found." },
      }),
  );
}

test("guess, watch, then solve a challenge in the experiment", async ({ page }) => {
  await mockLesson(page, FULL);
  await mockManifest(page);
  await page.goto(LESSON_URL);
  await expect(page.getByRole("status").first()).toHaveText("Lesson ready.");

  // The lesson opens on its problem; nothing gives the answer away first.
  await expect(page.getByRole("region", { name: "Quick answer" })).toHaveCount(0);
  await expect(page.locator(".rail h2").first()).toHaveText("Your guitar sounds flat");

  const activate = page.getByRole("region", { name: "You have heard this before" });
  await activate.getByRole("radio", { name: "Tighten the string" }).check();
  await activate.getByRole("button", { name: "Lock in my guess" }).click();
  await expect(activate.getByRole("status")).toHaveText(
    "Your guess: Tighten the string. You will find out after the demonstration.",
  );
  await expect(activate).not.toContainText("more tension makes the wave travel faster");

  const demonstrate = page.getByRole("region", { name: "Tension speeds up the wave" });
  const figure = demonstrate.getByRole("figure", { name: SAMPLE_MERRILL_MANIFEST.alt });
  const tension = figure.getByRole("slider", { name: "Tension" });
  await expect(tension).toHaveAttribute("aria-valuetext", "110 N");
  await demonstrate.getByRole("button", { name: "Show me step 2" }).click();
  await expect(tension).toHaveAttribute("aria-valuetext", "160 N");
  await expect(figure.locator("dd output")).toHaveText("178 Hz");
  await expect(demonstrate.locator(".guess-reveal")).toContainText(
    "You guessed: Tighten the string. That's right.",
  );

  const challenge = page.getByRole("article", { name: "Challenge 1" });
  await challenge.getByRole("radio", { name: "Raise the tension" }).check();
  await challenge.getByRole("button", { name: "Set up the experiment" }).click();
  await expect(tension).toHaveAttribute("aria-valuetext", "110 N");
  await expect(challenge.locator(".challenge__value")).toHaveText("147.3 Hz");

  await challenge.getByRole("button", { name: "Check" }).click();
  await expect(challenge.getByRole("status")).toContainText(
    "Pitch is 147.3 Hz; you need at least 180 Hz.",
  );

  // Moved from the keyboard, as a learner would move the slider: 110 N to 165 N.
  await tension.focus();
  for (let step = 0; step < 11; step += 1) await page.keyboard.press("ArrowRight");
  await expect(tension).toHaveAttribute("aria-valuetext", "165 N");
  await expect(challenge.locator(".challenge__value")).toHaveText("180.4 Hz");
  await challenge.getByRole("button", { name: "Check" }).click();
  await expect(challenge.getByRole("status")).toContainText("Solved.");
  await expect(challenge.getByRole("status")).toContainText(
    "Right: pitch grows with the square root of tension.",
  );
  await expectNoAxeViolations(page);
});

test("challenges stay answerable as multiple choice when the experiment cannot load", async ({
  page,
}) => {
  await mockLesson(page, FULL);
  await mockManifest(page, 404);
  await page.goto(LESSON_URL);
  await expect(page.getByRole("status").first()).toHaveText("Lesson ready.");
  const challenge = page.getByRole("article", { name: "Challenge 1" });
  await expect(challenge.getByRole("radio")).toHaveCount(0);
  await challenge.getByRole("button", { name: "Lower the tension" }).click();
  await expect(challenge.getByRole("status")).toContainText("Not quite. Try another.");
  await challenge.getByRole("button", { name: "Raise the tension" }).click();
  await expect(challenge.getByRole("status")).toContainText("Solved.");
  await expectNoAxeViolations(page);
});

test("shows a stage diagram beside the experiment, and the steps still drive the experiment", async ({
  page,
}) => {
  const diagramId = "0192f1a0-0000-7000-8000-00000000e021";
  const diagram = {
    visualId: diagramId,
    kind: "process",
    alt: "How a plucked string becomes sound",
    fallback: { text: "The string shakes, the body passes it on, and the air carries it." },
    assumptions: ["Only the main stages"],
    spec: "flowchart LR\n  pluck[Pluck] --> shake[String shakes] --> body[Body vibrates] --> air[Air carries sound]",
  };
  // The diagram comes first here on purpose: the experiment is found by kind, not by order.
  const visuals = {
    ...SAMPLE_MERRILL_VISUALS,
    visuals: [
      {
        visualId: diagramId,
        kind: "process",
        manifestUri: `/visuals?visualId=${diagramId}`,
        alt: diagram.alt,
      },
      ...SAMPLE_MERRILL_VISUALS.visuals,
    ],
  };
  await mockLesson(
    page,
    sseFrames([
      { type: "lesson", data: SAMPLE_MERRILL_LESSON },
      { type: "visuals", data: visuals },
    ]),
  );
  await mockManifest(page);
  await page.route(
    (url) => url.href.startsWith(`${API_URL}/visuals?`) && url.href.includes(diagramId),
    (route) => route.fulfill({ headers: CORS, json: diagram }),
  );
  await page.goto(LESSON_URL);

  const demonstrate = page.getByRole("region", { name: "Tension speeds up the wave" });
  const stages = demonstrate.getByRole("figure", { name: diagram.alt });
  await stages.getByRole("button", { name: "Show the diagram" }).click();
  await expect(stages.locator("svg[role=img]")).toBeVisible();

  const experiment = demonstrate.getByRole("figure", { name: SAMPLE_MERRILL_MANIFEST.alt });
  await demonstrate.getByRole("button", { name: "Show me step 2" }).click();
  await expect(experiment.getByRole("slider", { name: "Tension" })).toHaveAttribute(
    "aria-valuetext",
    "160 N",
  );
});
