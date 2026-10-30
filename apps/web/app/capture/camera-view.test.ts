import { describe, expect, it } from "vitest";
import { cameraProblem } from "./camera-view";

describe("cameraProblem", () => {
  it("explains a refused, missing or failing camera in plain words", () => {
    expect(cameraProblem(new DOMException("x", "NotAllowedError"))).toMatch(/not allowed/);
    expect(cameraProblem(new DOMException("x", "NotFoundError"))).toMatch(/couldn't find a camera/);
    expect(cameraProblem(new Error("boom"))).toBe("We couldn't start the camera here.");
  });
});
