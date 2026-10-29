export interface HttpOptions {
  userAgent?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  retryDelayMs?: number;
  timeoutMs?: number;
  maxBytes?: number;
}

export const USER_AGENT = "SBI-evidence/0.1 (research prototype)";

/** Wikimedia and others ask automated clients to name a contact; never a user's own details. */
export function userAgentWith(contact: string | undefined): string {
  return contact ? `SBI-evidence/0.1 (${contact})` : USER_AGENT;
}

export class SourceFetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SourceFetchError";
  }
}

const RETRYABLE = new Set([429, 502, 503, 504]);
const ATTEMPTS = 3;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface HttpResponse {
  url: string;
  text: string;
}

/** GET with a timeout, a size cap and backoff, since public APIs throttle bursts with 429s. */
export async function getText(
  url: string,
  options: HttpOptions = {},
  signal?: AbortSignal,
): Promise<HttpResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const maxBytes = options.maxBytes ?? 2_000_000;
  for (let attempt = 0; ; attempt += 1) {
    const timeout = AbortSignal.timeout(options.timeoutMs ?? 15_000);
    const response = await fetchImpl(url, {
      headers: { "User-Agent": options.userAgent ?? USER_AGENT },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (RETRYABLE.has(response.status) && attempt < ATTEMPTS - 1) {
      await sleep((options.retryDelayMs ?? 1000) * 2 ** attempt);
      continue;
    }
    if (!response.ok) {
      throw new SourceFetchError(`${url} answered ${response.status}`, response.status);
    }
    const declared = Number(response.headers.get("content-length") ?? 0);
    const text = declared > maxBytes ? "" : await response.text();
    if (declared > maxBytes || text.length > maxBytes) {
      throw new SourceFetchError(`${url} is larger than ${maxBytes} bytes`);
    }
    return { url: response.url || url, text };
  }
}

export async function getJson<T>(url: string, options: HttpOptions, signal?: AbortSignal) {
  const { text } = await getText(url, options, signal);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SourceFetchError(`${url} did not return JSON`);
  }
}
