import type {
  RecognitionImage,
  RecognitionOutcome,
  RecognitionProvider,
  RecogniseOptions,
} from "./vision-llm-recogniser";

export interface FallbackOutcome extends RecognitionOutcome {
  /** Providers that failed or timed out before this one answered. */
  fallbackFrom: string[];
}

export interface FallbackRecogniser extends RecognitionProvider {
  recognise(image: RecognitionImage, options?: RecogniseOptions): Promise<FallbackOutcome>;
}

export class RecognitionUnavailableError extends Error {
  constructor(readonly failures: { provider: string; reason: string }[]) {
    super(
      `Recognition unavailable: ${failures.map((f) => `${f.provider} (${f.reason})`).join(", ")}`,
    );
    this.name = "RecognitionUnavailableError";
  }
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Tries each provider in order, giving each its own timeout, so one slow vendor cannot stall capture. */
export function createFallbackRecogniser(
  providers: readonly RecognitionProvider[],
  { timeoutMs }: { timeoutMs: number },
): FallbackRecogniser {
  if (providers.length === 0) {
    throw new Error("Configure at least one recognition provider");
  }
  return {
    id: providers.map((provider) => provider.id).join(">"),
    async recognise(image, options = {}) {
      const failures: { provider: string; reason: string }[] = [];
      for (const provider of providers) {
        options.signal?.throwIfAborted();
        const timeout = AbortSignal.timeout(timeoutMs);
        const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
        try {
          const outcome = await provider.recognise(image, { signal });
          return { ...outcome, fallbackFrom: failures.map((failure) => failure.provider) };
        } catch (error) {
          // A caller cancel means nobody is waiting, so trying the fallback would only cost money.
          options.signal?.throwIfAborted();
          failures.push({
            provider: provider.id,
            reason: timeout.aborted ? `timed out after ${timeoutMs} ms` : reasonOf(error),
          });
        }
      }
      throw new RecognitionUnavailableError(failures);
    },
  };
}
