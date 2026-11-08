import { describe, expect, it } from "vitest";
import { classCode, enterClass, leaveClass, readClass } from "./class-context";

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("class context", () => {
  it("keeps the class for the tab and forgets it on leaving", () => {
    const storage = memory();
    expect(readClass(storage)).toBeUndefined();
    enterClass({ code: "7K3M-9QPX", name: "SSS2 Physics", tutorEnabled: false }, storage);
    expect(readClass(storage)).toEqual({
      code: "7K3M-9QPX",
      name: "SSS2 Physics",
      tutorEnabled: false,
    });
    expect(classCode(storage)).toBe("7K3M-9QPX");
    leaveClass(storage);
    expect(classCode(storage)).toBeUndefined();
  });

  it("ignores anything it didn't write", () => {
    const storage = memory();
    storage.setItem("sbi.class", "{not json");
    expect(readClass(storage)).toBeUndefined();
    storage.setItem("sbi.class", JSON.stringify({ code: 7 }));
    expect(readClass(storage)).toBeUndefined();
  });
});
