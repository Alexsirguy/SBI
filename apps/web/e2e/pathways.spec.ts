import { expect, test } from "@playwright/test";
import { SAMPLE_ANSWER, SAMPLE_LESSON, sseFrames } from "../app/lesson/sample-lesson";
import { expectNoAxeViolations } from "./a11y";
import { mockApi, mockLesson } from "./mock-api";

const FRAMES = sseFrames([
  { type: "quick-answer", data: SAMPLE_ANSWER },
  { type: "lesson", data: SAMPLE_LESSON },
  { type: "visuals", data: { lessonId: SAMPLE_LESSON.lessonId, visuals: [] } },
]);

test("who's learning is asked, not guessed, before the first lesson", async ({ page }) => {
  await page.goto("/capture");
  const who = page.getByRole("region", { name: "Who's learning?" });
  await expect(who).toContainText("We never guess anyone's age.");
  await expectNoAxeViolations(page);

  await who.getByRole("button", { name: "A child is learning" }).click();

  await expect(who.getByRole("status")).toHaveText(
    "Lessons are set for a child. A grown-up can change this.",
  );
});

test("the child pathway holds the child band even when a link asks for adults", async ({
  page,
  context,
}) => {
  await context.addCookies([{ name: "sbi_pathway", url: "http://localhost:3100", value: "child" }]);
  let audience: string | undefined;
  await mockLesson(page, FRAMES);
  await page.route("**/lessons", async (route) => {
    if (route.request().method() === "POST") audience = route.request().postDataJSON().audience;
    return route.fallback();
  });
  await mockApi(page, "/account", () => ({ json: { error: "x" }, status: 401 }));

  await page.goto("/lesson?taxonomyId=object.magnifying-glass&label=Magnifying+glass&age=adult");

  await expect.poll(() => audience).toBe("child");
  await expect(page.getByText("Set for a child.")).toBeVisible();
  await expect(page.getByLabel("Age band (optional)")).toHaveCount(0);
  await page.getByRole("button", { name: "Change (ask a grown-up)" }).click();
  await expect(page.getByText("Ask a grown-up", { exact: true })).toBeVisible();
  await expectNoAxeViolations(page);
});
