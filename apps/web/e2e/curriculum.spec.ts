import { expect, test } from "@playwright/test";
import {
  SAMPLE_ANSWER,
  SAMPLE_LESSON,
  SAMPLE_SOURCES,
  sseFrames,
} from "../app/lesson/sample-lesson";
import { expectNoAxeViolations } from "./a11y";
import { mockLesson } from "./mock-api";

const LESSON_URL = "/lesson?taxonomyId=object.magnifying-glass&label=Magnifying+glass";
const FULL = sseFrames([
  { type: "quick-answer", data: SAMPLE_ANSWER },
  { type: "lesson", data: SAMPLE_LESSON },
  { type: "sources", data: SAMPLE_SOURCES },
  { type: "visuals", data: { lessonId: SAMPLE_LESSON.lessonId, visuals: [] } },
]);

test("a learner switches the lesson's curriculum links between the US and Nigeria", async ({
  page,
}) => {
  await mockLesson(page, FULL);
  await page.goto(LESSON_URL);
  const panel = page.getByRole("region", { name: "Curriculum links" });
  const curriculum = panel.getByRole("combobox", { name: "Curriculum" });
  await expect(curriculum).toHaveValue("none");

  await curriculum.selectOption("us");
  await expect(panel.getByText("MS-PS4-2")).toBeVisible();

  await curriculum.selectOption("ng");
  await expect(panel.getByText("NG-PHY-SSS2-WAVES-LIGHT-REFRACTION")).toBeVisible();
  await expect(panel.getByText("MS-PS4-2")).toHaveCount(0);

  await panel.getByRole("combobox", { name: "Level" }).selectOption("SSS2");
  await expect(panel.getByRole("listitem")).toHaveCount(1);
  await expectNoAxeViolations(page);

  await page.reload();
  await expect(panel.getByRole("combobox", { name: "Curriculum" })).toHaveValue("ng");
  await expect(panel.getByRole("combobox", { name: "Level" })).toHaveValue("SSS2");
});
