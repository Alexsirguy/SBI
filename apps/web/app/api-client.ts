import {
  API_ROUTES,
  ApiError,
  type ApiRequest,
  type ApiResponse,
  type ApiRouteName,
  usesSession,
} from "@sbi/contracts";

export const UNREACHABLE =
  "The service is unavailable right now. Check your connection and try again.";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type ApiCall = <N extends ApiRouteName>(
  name: N,
  body: ApiRequest<N>,
) => Promise<ApiResponse<N>>;

function query(params: Record<string, string>): string {
  const search = new URLSearchParams(params).toString();
  return search ? `?${search}` : "";
}

// Requests and replies are checked against the shared contracts, so a drifted API fails loudly.
export function createApiClient(baseUrl: string, fetcher: typeof fetch = fetch): ApiCall {
  const root = baseUrl.replace(/\/+$/, "");
  return async (name, body) => {
    const route = API_ROUTES[name];
    const request = route.request.parse(body);
    // Only account and sign-in routes send the session cookie; lessons stay anonymous.
    const credentials: RequestInit = usesSession(name) ? { credentials: "include" } : {};
    let response: Response;
    try {
      // GETs carry no body or headers, so browsers send them without a CORS preflight.
      response =
        route.method === "get"
          ? await fetcher(`${root}${route.path}${query(request as Record<string, string>)}`, {
              ...credentials,
              method: "GET",
            })
          : await fetcher(`${root}${route.path}`, {
              body: JSON.stringify(request),
              ...credentials,
              headers: { "content-type": "application/json" },
              method: "POST",
            });
    } catch {
      throw new ApiRequestError(UNREACHABLE, 0);
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = ApiError.safeParse(payload);
      throw new ApiRequestError(error.success ? error.data.error : UNREACHABLE, response.status);
    }
    const parsed = route.response.safeParse(payload);
    if (!parsed.success) {
      throw new ApiRequestError("The server sent a reply we could not read.", response.status);
    }
    return parsed.data as ApiResponse<typeof name>;
  };
}

// Presigned PUTs go straight to storage, so they carry no API error body.
export async function putObject(url: string, blob: Blob, fetcher: typeof fetch = fetch) {
  const response = await fetcher(url, {
    body: blob,
    headers: { "content-type": blob.type || "image/jpeg" },
    method: "PUT",
  }).catch(() => null);
  if (!response?.ok) {
    throw new ApiRequestError(
      "The upload failed. Check your connection and try again.",
      response?.status ?? 0,
    );
  }
}
