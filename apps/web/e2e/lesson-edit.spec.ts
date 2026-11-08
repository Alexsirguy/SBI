import { expect, test } from "@playwright/test";
import { SAMPLE_MERRILL_LESSON } from "../app/lesson/sample-merrill-lesson";
import { expectNoAxeViolations } from "./a11y";
import { mockApi } from "./mock-api";

const ACCOUNT = {
  accountId: "0192f1a0-0000-7000-8000-000000000001",
  email: "teacher@example.com",
  emailVerified: true,
  firstName: "Ngozi",
  lastName: "Okafor",
  linkedAt: null,
};
const COPY_ID = "0192f1a0-0000-7000-8000-0000000000d7";
const original = SAMPLE_MERRILL_LESSON;
const problem = original.sections[0];
const copy = {
  ...original,
  disclaimers: [
    ...(original.disclaimers ?? []),
    {
      kind: "teacher-edited",
      message: "Your teacher edited parts of this lesson.",
      sectionIds: [problem?.sectionId ?? "problem"],
    },
  ],
  lessonId: COPY_ID,
  sections: original.sections.map((section, index) =>
    index === 0 ? { ...section, text: "Why does a tighter string sound higher?" } : section,
  ),
};
const opened = (lesson: typeof original) => ({
  lesson,
  savedAt: "2026-11-08T09:00:00.000Z",
  sources: { lessonId: lesson.lessonId, sources: [] },
  visuals: { lessonId: lesson.lessonId, visuals: [] },
});

test("a teacher edits a saved lesson, and the edited part is marked for pupils", async ({
  page,
}) => {
  let sent: unknown;
  await mockApi(page, "/account", () => ({ json: ACCOUNT }));
  await mockApi(page, "/account/lessons", () => ({ json: { lessons: [] } }));
  await mockApi(page, "/classes", () => ({ json: { classes: [], educator: true } }));
  await mockApi(page, "/account/lessons/open?", () => ({ json: opened(original) }));
  await mockApi(page, "/account/lessons/edit", (body) => {
    sent = body;
    return {
      json: {
        classesUpdated: 1,
        lesson: {
          lessonId: COPY_ID,
          savedAt: "2026-11-08T12:00:00.000Z",
          sharedAt: null,
          title: original.title,
          version: 1,
        },
      },
    };
  });
  await page.goto(`/lesson/saved?id=${original.lessonId}`);
  await page.getByRole("link", { name: "Edit lesson" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Edit: ${original.title}`);
  await expectNoAxeViolations(page);
  const text = page.getByRole("group", { name: "The problem" }).getByLabel("Text");
  await text.fill("Why does a tighter string sound higher?");

  await mockApi(page, "/account/lessons/open?", () => ({ json: opened(copy as typeof original) }));
  await page.getByRole("button", { name: "Save edits" }).click();

  await expect(page).toHaveURL(new RegExp(`/lesson/saved\\?id=${COPY_ID}`));
  await expect(page.getByText("Edits saved and updated in 1 class.")).toBeVisible();
  await expect(page.getByText("Edited by your teacher")).toHaveCount(1);
  await expect(page.getByText("weren't re-checked against its sources")).toBeVisible();
  expect(sent).toMatchObject({
    lessonId: original.lessonId,
    sections: [{ sectionId: problem?.sectionId, text: "Why does a tighter string sound higher?" }],
  });
  await expectNoAxeViolations(page);
});
