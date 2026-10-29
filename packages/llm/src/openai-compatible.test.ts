import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it, vi, type Mock } from "vitest";
import { createOpenAiCompatibleProvider, type OpenAiCompatibleOptions } from "./openai-compatible";
import { LlmError, type LlmEvent } from "./provider";

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

function provider(fetchImpl: typeof fetch, extra: Partial<OpenAiCompatibleOptions> = {}) {
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

  it("links the caller's abort signal to the request", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => ok("hi"));
    const controller = new AbortController();
    await provider(fetchImpl).complete({
      messages: [{ role: "user", content: "hi" }],
      signal: controller.signal,
    });
    const sent = fetchImpl.mock.calls[0]?.[1]?.signal;
    expect(sent?.aborted).toBe(false);

    const pending = provider(
      vi.fn<typeof fetch>(() => new Promise<Response>(() => undefined)),
      { retries: 0 },
    ).complete({ messages: [{ role: "user", content: "hi" }], signal: controller.signal });
    controller.abort(new Error("learner left"));
    await expect(pending).rejects.toThrow("learner left");
  });

  it("stops retrying once aborted", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      controller.abort(new Error("timed out"));
      return new Response("busy", { status: 503 });
    });
    await expect(
      provider(fetchImpl, { retries: 3 }).complete({
        messages: [{ role: "user", content: "hi" }],
        signal: controller.signal,
      }),
    ).rejects.toThrow("timed out");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not retry client errors", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("bad", { status: 400 }));
    await expect(
      provider(fetchImpl).complete({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toBeInstanceOf(LlmError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("times out a hung request", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => new Promise<Response>(() => undefined));
    await expect(
      provider(fetchImpl, { timeoutMs: 20, retries: 0 }).complete({
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow("meta: timed out after 20ms");
  });

  it("echoes the prompt ref and reports versions and usage, never content", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => ok("hi"));
    const events: LlmEvent[] = [];
    const result = await provider(fetchImpl, { onEvent: (event) => events.push(event) }).complete({
      messages: [{ role: "user", content: "secret question" }],
      prompt: { id: "lesson-draft", version: "2" },
    });

    expect(result.prompt).toEqual({ id: "lesson-draft", version: "2" });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      providerId: "meta",
      model: "muse-spark-1.3",
      prompt: { id: "lesson-draft", version: "2" },
      usage: { inputTokens: 10, cachedInputTokens: 2, outputTokens: 5 },
      outcome: "ok",
    });
    expect(JSON.stringify(events[0])).not.toContain("secret question");
  });

  it("reports terminal failures once", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("bad", { status: 400 }));
    const events: LlmEvent[] = [];
    await expect(
      provider(fetchImpl, { onEvent: (event) => events.push(event) }).complete({
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toBeInstanceOf(LlmError);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ outcome: "error", providerId: "meta" });
  });
});

// Real sockets: mocked Responses ignore the abort signal, which once hid a cancelled body read.
describe("createOpenAiCompatibleProvider over HTTP", () => {
  async function serve(handler: Parameters<typeof createServer>[1]) {
    const server = createServer(handler);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    return { baseUrl: `http://127.0.0.1:${port}`, close: () => server.close() };
  }
  const answer = '{"model":"m","choices":[{"message":{"content":"hello"}}],"usage":{}}';

  it("reads a streamed body to the end when a timeout is set", async () => {
    const server = await serve((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.write(answer.slice(0, 20));
      setTimeout(() => res.end(answer.slice(20)), 30);
    });
    try {
      const llm = provider(fetch, { baseUrl: server.baseUrl, timeoutMs: 2000, retries: 0 });
      expect((await llm.complete({ messages: [{ role: "user", content: "hi" }] })).text).toBe(
        "hello",
      );
    } finally {
      server.close();
    }
  });

  it("times out a body that stalls after the headers", async () => {
    const server = await serve((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.write(answer.slice(0, 20));
    });
    try {
      const llm = provider(fetch, { baseUrl: server.baseUrl, timeoutMs: 50, retries: 0 });
      await expect(llm.complete({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
        "meta: timed out after 50ms",
      );
    } finally {
      server.close();
    }
  });

  it("turns a refused connection into a provider error", async () => {
    const server = await serve(() => undefined);
    server.close();
    const llm = provider(fetch, { baseUrl: server.baseUrl, retries: 0 });
    await expect(
      llm.complete({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toBeInstanceOf(LlmError);
  });
});

describe("retries after a network failure", () => {
  it("tries again and succeeds", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockResolvedValueOnce(ok("second time"));
      const pending = provider(fetchImpl, { retries: 1 }).complete({
        messages: [{ role: "user", content: "hi" }],
      });
      await vi.advanceTimersByTimeAsync(1000);
      expect((await pending).text).toBe("second time");
    } finally {
      vi.useRealTimers();
    }
  });
});
