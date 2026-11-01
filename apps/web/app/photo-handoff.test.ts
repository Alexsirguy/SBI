import { afterEach, describe, expect, it, vi } from "vitest";
import { handedOffPhoto, handOffPhoto } from "./photo-handoff";

describe("photo hand-off", () => {
  afterEach(() => handOffPhoto(null));

  it("shows the photo only on lessons about the object it was taken of", () => {
    handOffPhoto("blob:kettle", "Electric kettle");
    expect(handedOffPhoto("Electric kettle")).toBe("blob:kettle");
    expect(handedOffPhoto(" electric KETTLE ")).toBe("blob:kettle");
    expect(handedOffPhoto("Rainbow")).toBeNull();
  });

  it("forgets the photo, and frees it, when a new object starts without one", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    handOffPhoto("blob:kettle", "Electric kettle");
    handOffPhoto(null);
    expect(handedOffPhoto("Electric kettle")).toBeNull();
    expect(revoke).toHaveBeenCalledWith("blob:kettle");
    revoke.mockRestore();
  });
});
