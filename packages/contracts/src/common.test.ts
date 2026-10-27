import { describe, expect, it } from "vitest";
import { newId, Uuid } from "./common";

describe("newId", () => {
  it("returns a valid UUIDv7", () => {
    const id = newId();

    expect(Uuid.safeParse(id).success).toBe(true);
    expect(id[14]).toBe("7");
  });

  it("sorts in creation order", () => {
    const ids = Array.from({ length: 50 }, () => newId());
    expect([...ids].sort()).toEqual(ids);
  });
});
