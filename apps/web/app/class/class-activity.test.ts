// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => vi.fn(async () => ({ ok: true })));
vi.mock("../api", () => ({ api }));

const { countForClass } = await import("./class-activity");
const { enterClass } = await import("./class-context");

afterEach(() => {
  window.sessionStorage.clear();
  api.mockClear();
});

describe("countForClass", () => {
  it("sends nothing outside a class", async () => {
    countForClass("visual_used");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(api).not.toHaveBeenCalled();
  });

  it("sends only the class code and the metric", async () => {
    enterClass({ code: "7K3M-9QPX", name: "Physics", tutorEnabled: true });
    countForClass("check_correct");
    await vi.waitFor(() =>
      expect(api).toHaveBeenCalledWith("recordClassActivity", {
        code: "7K3M-9QPX",
        metric: "check_correct",
      }),
    );
  });
});
