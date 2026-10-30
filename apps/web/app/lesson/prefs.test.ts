import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, parsePrefs, readPrefs, writePrefs } from "./prefs";

function memory() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

describe("lesson prefs", () => {
  it("keeps only known depths and age bands, defaulting to explore with no age", () => {
    expect(parsePrefs("deeper", "teen")).toEqual({ depth: "deeper", age: "teen" });
    expect(parsePrefs("max", "toddler")).toEqual(DEFAULT_PREFS);
    expect(parsePrefs(undefined, undefined)).toEqual({ depth: "explore", age: "none" });
  });

  it("remembers the choice for the session, and tolerates storage that refuses", () => {
    const storage = memory();
    expect(readPrefs(storage)).toBeUndefined();
    writePrefs({ depth: "quick", age: "child" }, storage);
    expect(readPrefs(storage)).toEqual({ depth: "quick", age: "child" });
    const refusing = {
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
      getItem: () => "{not json",
    };
    expect(() => writePrefs(DEFAULT_PREFS, refusing)).not.toThrow();
    expect(readPrefs(refusing)).toBeUndefined();
  });
});
