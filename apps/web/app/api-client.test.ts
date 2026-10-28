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

  it("surfaces the API's error message with its status", async () => {
    const api = createApiClient("http://api.test", replying(409, { error: "Already deleted." }));

    await expect(api("keepPhoto", { key: KEY })).rejects.toEqual(
      new ApiRequestError("Already deleted.", 409),
    );
  });

  it("reports an unreachable API without leaking network details", async () => {
    const api = createApiClient(
      "http://api.test",
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(api("keepPhoto", { key: KEY })).rejects.toThrow(UNREACHABLE);
  });

  it("rejects replies that break the contract", async () => {
    const api = createApiClient("http://api.test", replying(200, { key: "staging/x.jpg" }));

    await expect(api("confirmUpload", { token: "t" })).rejects.toThrow("could not read");
  });

  it("refuses to send a request that breaks the contract", async () => {
    const fetcher = replying(200, {});
    const api = createApiClient("http://api.test", fetcher);

    await expect(api("keepPhoto", { key: "../etc/passwd" })).rejects.toThrow();
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
