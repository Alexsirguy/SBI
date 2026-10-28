import { describe, expect, it, vi } from "vitest";
import { createFallbackRecogniser, RecognitionUnavailableError } from "./fallback";
import type { RecognitionOutcome, RecognitionProvider } from "./vision-llm-recogniser";

const image = { bytes: new Uint8Array([1]), mime: "image/jpeg" };

function outcome(provider: string): RecognitionOutcome {
  return {
    status: "recognised",
    candidates: [{ label: "kettle", certainty: "likely", calibratedConfidence: 0.9, reasons: [] }],
    observations: [],
    provider,
    model: `${provider}-model`,
    promptVersion: "test",
    latencyMs: 5,
    usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
  };
}

function answering(id: string): RecognitionProvider {
  return { id, recognise: vi.fn(async () => outcome(id)) };
}

function failing(id: string, error = new Error(`${id} down`)): RecognitionProvider {
  return {
    id,
    recognise: vi.fn(async () => {
      throw error;
    }),
  };
}

// Resolves only when aborted, like a provider that never answers.
function hanging(id: string): RecognitionProvider {
  return {
    id,
    recognise: vi.fn(
      (_image, options) =>
        new Promise<RecognitionOutcome>((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => reject(options.signal?.reason));
        }),
    ),
  };
}

describe("createFallbackRecogniser", () => {
  it("returns the primary answer without calling the fallback", async () => {
    const fallback = answering("openai-mini");
    const recogniser = createFallbackRecogniser([answering("meta-spark"), fallback], {
      timeoutMs: 1000,
    });

    const result = await recogniser.recognise(image);

    expect(result.provider).toBe("meta-spark");
    expect(result.fallbackFrom).toEqual([]);
    expect(fallback.recognise).not.toHaveBeenCalled();
  });

  it("falls back when the primary errors", async () => {
    const recogniser = createFallbackRecogniser([failing("meta-spark"), answering("openai-mini")], {
      timeoutMs: 1000,
    });

    const result = await recogniser.recognise(image);

    expect(result.provider).toBe("openai-mini");
    expect(result.fallbackFrom).toEqual(["meta-spark"]);
  });

  it("aborts a primary that exceeds the timeout and falls back", async () => {
    const primary = hanging("meta-spark");
    const recogniser = createFallbackRecogniser([primary, answering("openai-mini")], {
      timeoutMs: 20,
    });

    const result = await recogniser.recognise(image);

    expect(result.provider).toBe("openai-mini");
    const signal = vi.mocked(primary.recognise).mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(true);
  });

  it("throws RecognitionUnavailableError when every provider fails", async () => {
    const recogniser = createFallbackRecogniser([failing("meta-spark"), hanging("openai-mini")], {
      timeoutMs: 20,
    });

    await expect(recogniser.recognise(image)).rejects.toBeInstanceOf(RecognitionUnavailableError);
  });

  it("stops without trying the fallback when the caller cancels", async () => {
    const fallback = answering("openai-mini");
    const recogniser = createFallbackRecogniser([hanging("meta-spark"), fallback], {
      timeoutMs: 1000,
    });
    const controller = new AbortController();

    const pending = recogniser.recognise(image, { signal: controller.signal });
    controller.abort(new Error("learner left"));

    await expect(pending).rejects.toThrow("learner left");
    expect(fallback.recognise).not.toHaveBeenCalled();
  });

  it("needs at least one provider", () => {
    expect(() => createFallbackRecogniser([], { timeoutMs: 10 })).toThrow();
  });
});
