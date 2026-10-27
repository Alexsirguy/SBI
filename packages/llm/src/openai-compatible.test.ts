import { describe, expect, it, vi, type Mock } from "vitest";
import { createOpenAiCompatibleProvider } from "./openai-compatible";
import { LlmError } from "./provider";

const ok = (content: string) =>
  new Response(
    JSON.stringify({
      model: "muse-spark-1.3",
      choices: [{ message: { content } }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        prompt_tokens_details: { cached_tokens: 2 },
      },
    }),
  );

function provider(fetchImpl: typeof fetch, extra: object = {}) {
  return createOpenAiCompatibleProvider({
    id: "meta",
    baseUrl: "https://api.meta.ai/v1",
    apiKey: "key",
    model: "muse-spark-1.3",
    fetchImpl,
    retries: 1,
    ...extra,
  });
}

function sentBody(fetchImpl: Mock<typeof fetch>, call = 0) {
  return JSON.parse(String(fetchImpl.mock.calls[call]?.[1]?.body));
}

describe("createOpenAiCompatibleProvider", () => {
  it("sends images as data URLs and a strict JSON schema", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => ok('{"a":1}'));
    const result = await provider(fetchImpl).complete({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What is this?" },
            { type: "image", mime: "image/jpeg", base64: "AAAA" },
          ],
        },
      ],
      jsonSchema: { name: "Out", schema: { type: "object" } },
      maxTokens: 100,
    });

    const body = sentBody(fetchImpl);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://api.meta.ai/v1/chat/completions");
    expect(body.messages[0].content[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/jpeg;base64,AAAA" },
    });
    expect(body.response_format.json_schema).toEqual({
      name: "Out",
      schema: { type: "object" },
      strict: true,
    });
    expect(body.max_tokens).toBe(100);
    expect(result).toMatchObject({
      text: '{"a":1}',
      usage: { inputTokens: 10, cachedInputTokens: 2, outputTokens: 5 },
    });
  });

  it("uses the configured max-token parameter and extra body", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => ok("hi"));
    await provider(fetchImpl, {
      maxTokensParam: "max_completion_tokens",
      extraBody: { reasoning_effort: "low" },
    }).complete({ messages: [{ role: "user", content: "hi" }], maxTokens: 50 });

    expect(sentBody(fetchImpl)).toMatchObject({
      max_completion_tokens: 50,
      reasoning_effort: "low",
    });
  });

  it("retries rate limits and then succeeds", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("slow down", { status: 429 }))
      .mockResolvedValueOnce(ok("done"));
    const pending = provider(fetchImpl).complete({ messages: [{ role: "user", content: "hi" }] });
    await vi.runAllTimersAsync();

    expect((await pending).text).toBe("done");
    vi.useRealTimers();
  });

  it("does not retry client errors", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("bad", { status: 400 }));
    await expect(
      provider(fetchImpl).complete({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toBeInstanceOf(LlmError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
