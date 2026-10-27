import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createEnv } from "./create-env";
import { EnvError } from "./env-error";

const schema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().default(4000),
});

describe("createEnv", () => {
  it("parses and coerces valid values", () => {
    expect(createEnv(schema, { DATABASE_URL: "postgres://localhost/sbi", PORT: "5000" })).toEqual({
      DATABASE_URL: "postgres://localhost/sbi",
      PORT: 5000,
    });
  });

  it("treats empty strings as unset so defaults apply", () => {
    expect(createEnv(schema, { DATABASE_URL: "postgres://localhost/sbi", PORT: "" }).PORT).toBe(
      4000,
    );
  });

  it("fails fast listing every invalid variable", () => {
    expect(() => createEnv(schema, { PORT: "abc" })).toThrow(EnvError);
    expect(() => createEnv(schema, { PORT: "abc" })).toThrow(/DATABASE_URL[\s\S]*PORT/);
  });
});
