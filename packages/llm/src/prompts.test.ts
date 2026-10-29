import { describe, expect, it } from "vitest";
import { createPromptRegistry } from "./prompts";

const v1 = { id: "lesson-draft", version: "1", system: "Draft.", template: "Draft {{topic}}." };
const v2 = {
  id: "lesson-draft",
  version: "2",
  system: "Draft well.",
  template: "Draft {{topic}}!",
};

describe("createPromptRegistry", () => {
  it("resolves the latest version when none is requested", () => {
    const registry = createPromptRegistry([v1, v2]);

    expect(registry.get("lesson-draft")).toEqual(v2);
    expect(registry.get("lesson-draft", "1")).toEqual(v1);
  });

  it("rejects duplicate versions and unknown prompts", () => {
    const registry = createPromptRegistry([v1]);

    expect(() => registry.register(v1)).toThrow('Duplicate prompt "lesson-draft" version "1"');
    expect(() => registry.get("missing")).toThrow('Unknown prompt "missing"');
    expect(() => registry.get("lesson-draft", "9")).toThrow(
      'Unknown prompt "lesson-draft" version "9"',
    );
  });

  it("renders system and user messages with variables filled", () => {
    const registry = createPromptRegistry([v2]);

    expect(registry.render("lesson-draft", { topic: "kettles" })).toEqual([
      { role: "system", content: "Draft well." },
      { role: "user", content: "Draft kettles!" },
    ]);
  });

  it("fails on missing variables instead of sending a broken prompt", () => {
    const registry = createPromptRegistry([v1]);

    expect(() => registry.render("lesson-draft", {})).toThrow('Missing prompt variable "topic"');
  });
});
