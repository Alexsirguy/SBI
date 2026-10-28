export type ContentPart =
  { type: "text"; text: string } | { type: "image"; mime: string; base64: string };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface JsonSchemaFormat {
  name: string;
  schema: Record<string, unknown>;
}

export interface CompletionRequest {
  messages: ChatMessage[];
  jsonSchema?: JsonSchemaFormat;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface Usage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

export interface Completion {
  text: string;
  model: string;
  usage: Usage;
  latencyMs: number;
}

/** Provider-neutral text and vision completion. */
export interface LlmProvider {
  readonly id: string;
  readonly model: string;
  complete(request: CompletionRequest): Promise<Completion>;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
}
