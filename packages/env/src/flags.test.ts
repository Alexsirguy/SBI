import { describe, expect, it } from "vitest";
import { EnvError } from "./env-error";
import { parseFlags } from "./flags";

const defaults = { tutor: false, photoRecognition: true };

describe("parseFlags", () => {
  it("returns defaults when unset", () => {
    expect(parseFlags(defaults, undefined)).toEqual(defaults);
  });

  it("enables and disables named flags", () => {
    expect(parseFlags(defaults, "tutor, !photoRecognition")).toEqual({
      tutor: true,
      photoRecognition: false,
    });
  });

  it("rejects unknown flags so typos are caught", () => {
    expect(() => parseFlags(defaults, "tutr")).toThrow(EnvError);
  });
});
