import {
  LlmError,
  type ChatMessage,
  type Completion,
  type CompletionRequest,
  type LlmEventSink,
  type LlmProvider,
} from "./provider";

export const META_MODEL_API_BASE_URL = "https://api.meta.ai/v1";
export const OPENAI_BASE_URL = "https://api.openai.com/v1";

export interface OpenAiCompatibleOptions {
  id: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  // OpenAI's newer models reject max_tokens; Meta's chat endpoint documents max_tokens.
  maxTokensParam?: "max_tokens" | "max_completion_tokens";
  extraBody?: Record<string, unknown>;
  retries?: number;
  fetchImpl?: typeof fetch;
  // Per-attempt deadline; each retry gets a fresh budget. Use the request signal for a total deadline.
  timeoutMs?: number;
  /** Called once per complete() call with versions and usage, never message text. */
  onEvent?: LlmEventSink;
}

interface ChatCompletionResponse {
  model?: string;
  choices?: { message?: { content?: string | null } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
}

function toWireMessage(message: ChatMessage) {
  if (typeof message.content === "string") return message;
  return {
    role: message.role,
    content: message.content.map((part) =>
      part.type === "text"
        ? part
        : { type: "image_url", image_url: { url: `data:${part.mime};base64,${part.base64}` } },
    ),
  };
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

/** LLM provider for any Chat Completions-compatible API, including Meta Model API and OpenAI. */
export function createOpenAiCompatibleProvider(options: OpenAiCompatibleOptions): LlmProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const retries = options.retries ?? 3;

  // Races the request so a hung connection still hits the deadline.
  async function attemptFetch(
    body: unknown,
    caller: AbortSignal | undefined,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    let onCallerAbort: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pending = fetchImpl(`${options.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    pending.then(undefined, () => undefined);
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new LlmError(`${options.id}: timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    const aborted = new Promise<never>((_, reject) => {
      if (!caller) return;
      if (caller.aborted) {
        reject(caller.reason);
        return;
      }
      onCallerAbort = () => reject(caller.reason);
      caller.addEventListener("abort", onCallerAbort, { once: true });
    });
    try {
      return await Promise.race([pending, timeout, aborted]);
    } finally {
      clearTimeout(timer);
      if (caller && onCallerAbort) caller.removeEventListener("abort", onCallerAbort);
      controller.abort();
    }
  }

  async function post(body: unknown, signal?: AbortSignal): Promise<ChatCompletionResponse> {
    for (let attempt = 0; ; attempt += 1) {
      signal?.throwIfAborted();
      const response =
        options.timeoutMs === undefined
          ? await fetchImpl(`${options.baseUrl}/chat/completions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${options.apiKey}`,
              },
              body: JSON.stringify(body),
              signal,
            })
          : await attemptFetch(body, signal, options.timeoutMs);
      signal?.throwIfAborted();
      if (response.ok) return (await response.json()) as ChatCompletionResponse;
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt >= retries) {
        throw new LlmError(
          `${options.id}: HTTP ${response.status} ${await response.text()}`,
          response.status,
        );
      }
      await sleep(1000 * 2 ** attempt, signal);
    }
  }

  return {
    id: options.id,
    model: options.model,
    async complete(request: CompletionRequest): Promise<Completion> {
      const body = {
        model: options.model,
        messages: request.messages.map(toWireMessage),
        ...(request.maxTokens
          ? { [options.maxTokensParam ?? "max_tokens"]: request.maxTokens }
          : {}),
        ...(request.jsonSchema
          ? {
              response_format: {
                type: "json_schema",
                json_schema: { ...request.jsonSchema, strict: true },
              },
            }
          : {}),
        ...options.extraBody,
      };
      const started = performance.now();
      try {
        const data = await post(body, request.signal);
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new LlmError(`${options.id}: empty completion`);
        const completion: Completion = {
          text,
          model: data.model ?? options.model,
          latencyMs: Math.round(performance.now() - started),
          usage: {
            inputTokens: data.usage?.prompt_tokens ?? 0,
            cachedInputTokens: data.usage?.prompt_tokens_details?.cached_tokens ?? 0,
            outputTokens: data.usage?.completion_tokens ?? 0,
          },
          prompt: request.prompt,
        };
        options.onEvent?.({
          providerId: options.id,
          model: completion.model,
          prompt: request.prompt,
          usage: completion.usage,
          latencyMs: completion.latencyMs,
          outcome: "ok",
        });
        return completion;
      } catch (error) {
        options.onEvent?.({
          providerId: options.id,
          model: options.model,
          prompt: request.prompt,
          latencyMs: Math.round(performance.now() - started),
          outcome: "error",
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  };
}
