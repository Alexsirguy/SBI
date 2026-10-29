import { LlmError, type Completion, type CompletionRequest, type LlmProvider } from "./provider";

export interface StructuredRequest<T> extends CompletionRequest {
  /** Parses raw model text; must throw on invalid JSON or schema mismatch. */
  parse: (text: string) => T;
}

export interface StructuredCompletion<T> {
  value: T;
  completion: Completion;
}

// Caller-supplied parsers keep this package free of schema libraries.
export async function completeStructured<T>(
  provider: LlmProvider,
  request: StructuredRequest<T>,
): Promise<StructuredCompletion<T>> {
  const { parse, ...rest } = request;
  const completion = await provider.complete(rest);
  try {
    return { value: parse(completion.text), completion };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new LlmError(`${provider.id}: invalid structured output (${detail})`);
  }
}
