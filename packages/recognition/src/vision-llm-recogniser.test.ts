import type { CompletionRequest, LlmProvider } from "@sbi/llm";
import { describe, expect, it } from "vitest";
import { createVisionLlmRecogniser } from "./vision-llm-recogniser";

function fakeLlm(text: string, seen: CompletionRequest[] = []): LlmProvider {
  return {
    id: "fake",
    model: "fake-1",
    async complete(request) {
      seen.push(request);
      return {
        text,
        model: "fake-1",
        latencyMs: 12,
        usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
      };
    },
  };
}

const image = { bytes: new Uint8Array([1, 2, 3]), mime: "image/jpeg" };

describe("createVisionLlmRecogniser", () => {
  it("sends the photo inline and returns validated candidates", async () => {
    const seen: CompletionRequest[] = [];
    const output = {
      status: "recognised",
      candidates: [
        { label: "bicycle", certainty: "likely", calibratedConfidence: 0.93, reasons: ["chain"] },
      ],
      observations: ["two wheels"],
    };
    const result = await createVisionLlmRecogniser(fakeLlm(JSON.stringify(output), seen)).recognise(
      image,
    );

    expect(result).toMatchObject({ ...output, provider: "fake", latencyMs: 12 });
    expect(seen[0]?.jsonSchema?.name).toBe("RecognitionOutput");
    expect(result.promptVersion).toBe("recognition-p0.2");
    expect(seen[0]?.messages[0]?.content).toContain("two closest look-alikes");
    expect(seen[0]?.messages[1]?.content).toContainEqual({
      type: "image",
      mime: "image/jpeg",
      base64: "AQID",
    });
  });

  it("rejects output outside the contract", async () => {
    const bad = JSON.stringify({
      status: "recognised",
      candidates: [{ label: "x", certainty: "certain", calibratedConfidence: 2, reasons: [] }],
      observations: [],
    });
    await expect(createVisionLlmRecogniser(fakeLlm(bad)).recognise(image)).rejects.toThrow();
  });
});
