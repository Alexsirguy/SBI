import { describe, expect, it, vi } from "vitest";
import { ApiRequestError, createApiClient, putObject, UNREACHABLE } from "./api-client";

const KEY = "photos/0192f1a0-0000-7000-8000-000000000001.jpg";

function replying(status: number, body: unknown) {
  return vi.fn<typeof fetch>(async () => Response.json(body, { status }));
}

describe("createApiClient", () => {
  it("posts the validated request to the contract path and parses the reply", async () => {
    const fetcher = replying(200, { contentType: "image/jpeg", key: KEY });
    const api = createApiClient("http://api.test/", fetcher);

    await expect(api("confirmUpload", { token: "t" })).resolves.toEqual({
      contentType: "image/jpeg",
      key: KEY,
    });
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("http://api.test/uploads/confirm");
    expect(init).toMatchObject({ body: '{"token":"t"}', method: "POST" });
  });

  it("sends GET requests as a query string without a body", async () => {
    const fetcher = replying(200, {
      results: [{ label: "Bicycle", taxonomyId: "object.bicycle" }],
    });
    const api = createApiClient("http://api.test", fetcher);

    await expect(api("searchTaxonomy", { q: " bike & co " })).resolves.toEqual({
      results: [{ label: "Bicycle", taxonomyId: "object.bicycle" }],
    });
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("http://api.test/taxonomy/search?q=bike+%26+co");
    expect(init).toEqual({ method: "GET" });
  });

  it("sends the session cookie on account and sign-in routes only", async () => {
    const fetcher = replying(200, { ok: true });
    const api = createApiClient("http://api.test", fetcher);

    await api("signOut", {}).catch(() => undefined);
    await api("searchTaxonomy", { q: "bike" }).catch(() => undefined);

    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ credentials: "include", method: "POST" });
    expect(fetcher.mock.calls[1]?.[1]).toEqual({ method: "GET" });
  });

  it("leaves off the query string when a GET has no parameters", async () => {
    const fetcher = replying(401, { error: "Sign in to use your account." });
    const api = createApiClient("http://api.test", fetcher);

    await api("getAccount", {}).catch(() => undefined);

    expect(fetcher.mock.calls[0]?.[0]).toBe("http://api.test/account");
    expect(fetcher.mock.calls[0]?.[1]).toEqual({ credentials: "include", method: "GET" });
  });

  it("surfaces the API's error message with its status", async () => {
    const api = createApiClient("http://api.test", replying(409, { error: "Already deleted." }));

    await expect(api("keepPhoto", { key: KEY, consentVersion: "consent-1" })).rejects.toEqual(
      new ApiRequestError("Already deleted.", 409),
    );
  });

  it("reports an unreachable API without leaking network details", async () => {
    const api = createApiClient(
      "http://api.test",
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(api("keepPhoto", { key: KEY, consentVersion: "consent-1" })).rejects.toThrow(
      UNREACHABLE,
    );
  });

  it("rejects replies that break the contract", async () => {
    const api = createApiClient("http://api.test", replying(200, { key: "staging/x.jpg" }));

    await expect(api("confirmUpload", { token: "t" })).rejects.toThrow("could not read");
  });

  it("refuses to send a request that breaks the contract", async () => {
    const fetcher = replying(200, {});
    const api = createApiClient("http://api.test", fetcher);

    await expect(
      api("keepPhoto", { key: "../etc/passwd", consentVersion: "consent-1" }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("putObject", () => {
  it("fails with a retry hint when storage refuses the upload", async () => {
    const blob = new Blob(["x"], { type: "image/jpeg" });

    await expect(putObject("https://r2.test/put", blob, replying(403, ""))).rejects.toThrow(
      "Check your connection",
    );
  });
});
