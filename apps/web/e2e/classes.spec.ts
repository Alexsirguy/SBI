import { expect, test } from "@playwright/test";
import { SAMPLE_LESSON, SAMPLE_SOURCES } from "../app/lesson/sample-lesson";
import { expectNoAxeViolations, expectVisibleFocus, tabTo } from "./a11y";
import { mockApi } from "./mock-api";

const ACCOUNT = {
  accountId: "0192f1a0-0000-7000-8000-000000000001",
  email: "teacher@example.com",
  emailVerified: true,
  firstName: "Ngozi",
  lastName: "Okafor",
  linkedAt: null,
};
const CLASS = {
  archivedAt: null,
  classId: "0192f1a0-0000-7000-8000-0000000000e1",
  codeHint: "PX",
  controls: { audienceLock: null, blockedCategories: [], tutorEnabled: true },
  createdAt: "2026-11-08T09:00:00.000Z",
  curriculum: "ng",
  lessons: [],
  level: "SSS2",
  name: "SSS2 Physics",
};

test("a teacher turns on teaching tools, makes a class and sees its code once", async ({
  page,
}) => {
  let educator = false;
  await mockApi(page, "/account", () => ({ json: ACCOUNT }));
  await mockApi(page, "/account/lessons", () => ({ json: { lessons: [] } }));
  await mockApi(page, "/classes", () => ({ json: { classes: [], educator } }));
  await mockApi(page, "/classes/educator", () => {
    educator = true;
    return { json: { educator: true } };
  });
  await mockApi(page, "/classes/create", (body) => ({
    json: { class: { ...CLASS, name: (body as { name: string }).name }, joinCode: "7K3M-9QPX" },
  }));
  await page.goto("/teach");

  await page.getByRole("button", { name: "Turn on teaching tools" }).click();
  await page.getByLabel("Class name").fill("SSS2 Physics");
  await page.getByLabel("Curriculum").selectOption("ng");
  await page.getByLabel("Level").selectOption("SSS2");
  await page.getByRole("button", { name: "Create class" }).click();

  const code = page.getByRole("region", { name: "Code for SSS2 Physics" });
  await expect(code).toContainText("7K3M-9QPX");
  await expect(code).toContainText("/class?code=7K3M-9QPX");
  await expectNoAxeViolations(page);

  await code.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("7K3M-9QPX")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "SSS2 Physics" })).toContainText("Code ends in PX");
  const tutor = page.getByLabel("Pupils can ask the tutor");
  await tabTo(page, tutor);
  await expectVisibleFocus(tutor);
  await expectNoAxeViolations(page);
});

test("a pupil opens a class by code, with no sign-in, and reads its lesson", async ({ page }) => {
  await mockApi(page, "/class?", () => ({
    json: {
      controls: { audienceLock: "child", blockedCategories: [], tutorEnabled: false },
      curriculum: "ng",
      lessons: [{ lessonId: SAMPLE_LESSON.lessonId, title: SAMPLE_LESSON.title, version: 1 }],
      level: "SSS2",
      name: "SSS2 Physics",
    },
  }));
  await mockApi(page, "/class/lesson?", () => ({
    json: {
      lesson: SAMPLE_LESSON,
      sources: SAMPLE_SOURCES,
      visuals: { lessonId: SAMPLE_LESSON.lessonId, visuals: [] },
    },
  }));
  await page.goto("/class");
  await page.getByLabel("Class code").fill("7k3m 9qpx");
  await page.getByRole("button", { name: "Open class" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("SSS2 Physics");
  await expect(page.getByText("turned the tutor off")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("link", { name: SAMPLE_LESSON.title }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(SAMPLE_LESSON.title);
  await expect(page.getByRole("link", { name: "Back to SSS2 Physics" })).toBeVisible();
  const curriculum = page
    .getByRole("region", { name: "Curriculum links" })
    .getByRole("combobox", { name: "Curriculum" });
  await expect(curriculum).toHaveValue("ng");
  await expectNoAxeViolations(page);
});

test("a pupil with an old code is told to ask for the new one", async ({ page }) => {
  await mockApi(page, "/class?", () => ({
    json: { error: "This class link doesn't work any more. Ask your teacher for the new one." },
    status: 404,
  }));
  await page.goto("/class?code=7K3M-9QPX");
  await expect(page.getByRole("alert").filter({ hasText: "Ask your teacher" })).toBeVisible();
  await expect(page.getByLabel("Class code")).toHaveValue("7K3M-9QPX");
});
