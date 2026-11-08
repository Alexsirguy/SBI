// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, text } from "../lesson/dom-test";

const api = vi.hoisted(() => vi.fn());
vi.mock("../api", () => ({ api }));

const { ClassSummaryTable } = await import("./class-summary");
const CLASS_ID = "0192f1a0-0000-7000-8000-0000000000e1";

afterEach(() => {
  document.body.replaceChildren();
  api.mockReset();
});

const view = () =>
  mount(
    <QueryClientProvider client={new QueryClient()}>
      <ClassSummaryTable classId={CLASS_ID} />
    </QueryClientProvider>,
  );

describe("ClassSummaryTable", () => {
  it("shows whole-class counts by week and says where a count is hidden", async () => {
    api.mockResolvedValue({
      minCount: 5,
      totals: { check_answered: 31, check_correct: null, lesson_opened: 40, visual_used: 0 },
      weeks: [
        {
          counts: { check_answered: 20, check_correct: null, lesson_opened: 25, visual_used: 0 },
          week: "2026-W45",
        },
      ],
    });
    const { container } = await view();
    await vi.waitFor(() => expect(container.querySelector("table")).not.toBeNull());
    expect(api).toHaveBeenCalledWith("classSummary", { classId: CLASS_ID });
    const rows = [...container.querySelectorAll("tbody tr, tfoot tr")].map((row) =>
      [...row.children].map((cell) => text(cell)),
    );
    expect(rows).toEqual([
      ["2026-W45", "25", "20", "fewer than 5", "0"],
      ["All weeks", "40", "31", "fewer than 5", "0"],
    ]);
    expect(text(container)).toContain("There is no view of single pupils");
  });

  it("says when there is nothing yet", async () => {
    api.mockResolvedValue({
      minCount: 5,
      totals: { check_answered: 0, check_correct: 0, lesson_opened: 0, visual_used: 0 },
      weeks: [],
    });
    const { container } = await view();
    await vi.waitFor(() => expect(text(container)).toContain("Nothing yet"));
  });
});
