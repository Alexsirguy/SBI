import { describe, expect, it } from "vitest";
import { completeStructured } from "./structured";
import { LlmError, type Completion, type LlmProvider } from "./provider";

function stubProvider(text: string): LlmProvider {
  return {
    id: "stub",
    model: "stub-1",
    async complete(request): Promise<Completion> {
      return {
        text,
        model: "stub-1",
        usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 },
        latencyMs: 0,
        prompt: request.prompt,
      };
    },
  };
}

describe("completeStructured", () => {
  it("returns the parsed value with the raw completion", async () => {
    const result = await completeStructured(stubProvider('{"a":1}'), {
      messages: [{ role: "user", content: "hi" }],
      parse: (text) => JSON.parse(text) as { a: number },
    });

    expect(result.value).toEqual({ a: 1 });
    expect(result.completion.text).toBe('{"a":1}');
  });

  it("wraps invalid output in LlmError", async () => {
    await expect(
      completeStructured(stubProvider("not json"), {
        messages: [{ role: "user", content: "hi" }],
        parse: (text) => JSON.parse(text),
      }),
    ).rejects.toThrow(/^stub: invalid structured output/);
    await expect(
      completeStructured(stubProvider('{"a":1}'), {
        messages: [{ role: "user", content: "hi" }],
        parse: () => {
          throw new Error("missing field b");
        },
      }),
    ).rejects.toThrow("stub: invalid structured output (missing field b)");
  });

  it("lets provider errors through unwrapped", async () => {
    const failing: LlmProvider = {
      id: "stub",
      model: "stub-1",
      async complete() {
        throw new LlmError("stub: empty completion");
      },
    };

    await expect(
      completeStructured(failing, {
        messages: [{ role: "user", content: "hi" }],
        parse: (text) => text,
      }),
    ).rejects.toThrow("stub: empty completion");
  });
});
