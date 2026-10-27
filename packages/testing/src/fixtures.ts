import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

export interface ParsableSchema {
  safeParse(input: unknown): { success: boolean; error?: unknown };
}

export interface Fixture {
  name: string;
  data: unknown;
}

function readFixtures(dir: string): Fixture[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => ({ name: file, data: JSON.parse(readFileSync(join(dir, file), "utf8")) }));
}

/** Loads `valid/*.json` and `invalid/*.json` from a fixture directory. */
export function loadFixtures(dir: string): { valid: Fixture[]; invalid: Fixture[] } {
  return { valid: readFixtures(join(dir, "valid")), invalid: readFixtures(join(dir, "invalid")) };
}

/** Registers one test per fixture asserting it matches, or is rejected by, the schema. */
export function describeContract(name: string, schema: ParsableSchema, dir: string): void {
  const { valid, invalid } = loadFixtures(dir);

  describe(`${name} contract`, () => {
    it("has at least one valid and one invalid fixture", () => {
      expect(valid.length).toBeGreaterThan(0);
      expect(invalid.length).toBeGreaterThan(0);
    });

    it.each(valid)("accepts $name", ({ data }) => {
      const result = schema.safeParse(data);
      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
    });

    it.each(invalid)("rejects $name", ({ data }) => {
      expect(schema.safeParse(data).success).toBe(false);
    });
  });
}
