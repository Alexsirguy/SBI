import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { describeContract, loadFixtures } from "./fixtures";

const dir = join(import.meta.dirname, "fixtures/sample");
const schema = z.object({ id: z.string(), version: z.number().int().positive() });

describeContract("sample", schema, dir);

describe("loadFixtures", () => {
  it("reads valid and invalid fixtures in name order", () => {
    const { valid, invalid } = loadFixtures(dir);

    expect(valid.map((f) => f.name)).toEqual(["basic.json"]);
    expect(invalid.map((f) => f.name)).toEqual(["missing-id.json", "zero-version.json"]);
  });
});
