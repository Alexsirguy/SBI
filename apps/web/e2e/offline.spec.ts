import { expect, test } from "@playwright/test";
import {
  SAMPLE_ANSWER,
  SAMPLE_LESSON,
  SAMPLE_SOURCES,
  sseFrames,
} from "../app/lesson/sample-lesson";
import { expectNoAxeViolations } from "./a11y";
import { mockApi, mockLesson } from "./mock-api";

const LESSON_URL = "/lesson?taxonomyId=object.magnifying-glass&label=Magnifying+glass";
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const DIAGRAM_ID = "0192f1a0-0000-7000-8000-00000000e031";
const HELD_ID = "0192f1a0-0000-7000-8000-00000000e032";
const ASSET_ID = "0192f1a0-0000-7000-8000-00000000e0a1";
const diagram = {
  alt: "How a lens bends light",
  assumptions: [],
  assetIds: [ASSET_ID],
  credits: [
    {
      assetId: ASSET_ID,
      license: { label: "MIT", url: "https://opensource.org/licenses/MIT" },
      shareAlike: false,
      text: "Diagram drawn with Mermaid (MIT licence)",
    },
  ],
  fallback: { text: "Light bends going into the glass and again coming out." },
  kind: "process",
  spec: "flowchart LR\n  air[Air] --> glass[Glass bends light] --> eye[Eye sees it bigger]",
  visualId: DIAGRAM_ID,
};
const refs = [
  {
    alt: diagram.alt,
    kind: "process",
    manifestUri: `/visuals?visualId=${DIAGRAM_ID}`,
    visualId: DIAGRAM_ID,
  },
  {
    alt: "Drag the lens closer",
    kind: "playground",
    manifestUri: `/visuals?visualId=${HELD_ID}`,
    visualId: HELD_ID,
  },
];
const lesson = { ...SAMPLE_LESSON, visuals: refs };
const pack = {
  exportedAt: "2026-11-08T12:00:00.000Z",
  format: "sbi-lesson-pack",
  lesson,
  packVersion: 1,
  sources: SAMPLE_SOURCES,
  visuals: [diagram],
  withheld: [
    {
      alt: "Drag the lens closer",
      kind: "playground",
      reason: "needs-connection",
      text: "Moving the lens closer makes the picture bigger, up to a point.",
      visualId: HELD_ID,
    },
  ],
};

test("a saved lesson opens with no connection, with its diagram and credits", async ({
  page,
  context,
}) => {
  await mockLesson(
    page,
    sseFrames([
      { type: "quick-answer", data: SAMPLE_ANSWER },
      { type: "lesson", data: lesson },
      { type: "sources", data: SAMPLE_SOURCES },
      { type: "visuals", data: { lessonId: lesson.lessonId, visuals: [refs[0]] } },
    ]),
  );
  await page.route(
    (url) => url.href.startsWith(`${API_URL}/visuals?`),
    (route) => route.fulfill({ headers: { "access-control-allow-origin": "*" }, json: diagram }),
  );
  await mockApi(page, "/lessons/pack", () => ({ json: pack }));
  await page.goto(LESSON_URL);
  const figure = page.getByRole("figure", { name: diagram.alt });
  // Drawn once online, so the diagram's renderer is among the files kept for offline use.
  await figure.getByRole("button", { name: "Show the diagram" }).click();
  await expect(figure.locator("svg[role=img]")).toBeVisible();

  await page.getByRole("button", { name: "Save for offline" }).click();
  await expect(page.getByText("Saved on this device.")).toBeVisible();

  await context.setOffline(true);
  await page.goto(`/offline?id=${lesson.lessonId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(lesson.title);
  const offlineFigure = page.getByRole("figure", { name: diagram.alt });
  await offlineFigure.getByRole("button", { name: "Show the diagram" }).click();
  await expect(offlineFigure.locator("svg[role=img]")).toBeVisible();
  await expect(page.getByText("Diagram drawn with Mermaid (MIT licence)").first()).toBeVisible();
  await expect(page.getByText("This interactive needs a connection.")).toBeVisible();
  await expect(page.getByText("Moving the lens closer makes the picture bigger")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.goto("/offline");
  await expect(page.getByRole("link", { name: lesson.title })).toBeVisible();
  await context.setOffline(false);
});
