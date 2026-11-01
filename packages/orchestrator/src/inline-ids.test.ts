import { describe, expect, it } from "vitest";
import { withoutInlineIds } from "./inline-ids";

describe("withoutInlineIds", () => {
  it("removes claim ids a model wrote into the text", () => {
    expect(
      withoutInlineIds(
        "Torque makes things turn [01a189b8-d216-713f-a7a8-3e2c44650553]. It grows with distance (01a189b8-d218-7377-8b85-5b8490ed5b9b).",
      ),
    ).toBe("Torque makes things turn. It grows with distance.");
  });
});
