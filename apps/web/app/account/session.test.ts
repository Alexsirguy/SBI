import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./session";

describe("safeReturnTo", () => {
  it("follows paths on this site only", () => {
    expect(safeReturnTo("/lesson?id=1")).toBe("/lesson?id=1");
    for (const unsafe of [
      "//evil.test/x",
      "https://evil.test",
      "javascript:alert(1)",
      42,
      undefined,
    ]) {
      expect(safeReturnTo(unsafe)).toBe("/account");
    }
  });
});
