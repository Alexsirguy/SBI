import { Account, CONSENT_VERSION, LinkedAccount } from "@sbi/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { ACCOUNTS, TOKEN_VERIFIER } from "../tokens";
import {
  fakeMedia,
  fakeRecognition,
  fakeGaps,
  startTestApp,
  WEB_ORIGIN,
  type TestApp,
} from "../testing/test-app";
import { fakeAccounts, fakeProvider } from "../testing/test-auth";

const KEY = "photos/0192f1a0-0000-7000-8000-000000000001.jpg";
const consent = (account: boolean, version = CONSENT_VERSION) => ({
  choices: { account, "model-improvement": false, research: false, "save-photos": true },
  decidedAt: "2026-11-02T10:00:00.000Z",
  version,
});

async function start(withProvider = true) {
  const provider = await fakeProvider();
  const accounts = fakeAccounts();
  const test = await startTestApp(fakeMedia(), fakeRecognition(), fakeGaps(), (builder) =>
    builder
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(withProvider ? provider.verifier : null)
      .overrideProvider(ACCOUNTS)
      .useValue(accounts.repository),
  );
  const bearer = async (subject = "auth0|learner") => ({
    authorization: `Bearer ${await provider.sign(subject)}`,
  });
  return { accounts, bearer, provider, test };
}

describe("account routes", () => {
  let test: TestApp | undefined;

  afterEach(async () => {
    await test?.app.close();
  });

  it("creates the account on first sign-in and returns the same one after", async () => {
    const started = await start();
    test = started.test;

    const first = Account.parse(await (await test.get("/account", await started.bearer())).json());
    const again = Account.parse(await (await test.get("/account", await started.bearer())).json());

    expect(again.accountId).toBe(first.accountId);
    expect(first.linkedAt).toBeNull();
  });

  it("refuses missing, forged, expired and wrong-audience tokens", async () => {
    const started = await start();
    test = started.test;
    const other = await fakeProvider();

    const tokens = [
      undefined,
      "Bearer not-a-jwt",
      `Bearer ${await other.sign("auth0|learner")}`,
      `Bearer ${await started.provider.sign("auth0|learner", { expiresIn: "-1m" })}`,
      `Bearer ${await started.provider.sign("auth0|learner", { audience: "https://elsewhere" })}`,
    ];
    for (const authorization of tokens) {
      const response = await test.get("/account", authorization ? { authorization } : {});
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Sign in again to use your account." });
    }
  });

  it("says accounts are unavailable when no provider is configured", async () => {
    const started = await start(false);
    test = started.test;

    const response = await test.get("/account", await started.bearer());

    expect(response.status).toBe(503);
  });

  it("links kept photos only with the account opt-in under current wording", async () => {
    const started = await start();
    test = started.test;
    const headers = await started.bearer();

    for (const refused of [consent(false), consent(true, "consent-0")]) {
      const response = await test.post(
        "/account/link",
        { consent: refused, photoKeys: [KEY] },
        headers,
      );
      expect(response.status).toBe(400);
    }
    expect(started.accounts.owners.size).toBe(0);

    const response = await test.post(
      "/account/link",
      { consent: consent(true), photoKeys: [KEY, KEY] },
      headers,
    );
    expect(response.status).toBe(200);
    expect(LinkedAccount.parse(await response.json()).linkedPhotos).toBe(1);
    const account = Account.parse(await (await test.get("/account", headers)).json());
    expect(account.linkedAt).not.toBeNull();
  });

  it("unlinks on withdrawal so photos are no longer tied to the account", async () => {
    const started = await start();
    test = started.test;
    const headers = await started.bearer();
    await test.post("/account/link", { consent: consent(true), photoKeys: [KEY] }, headers);

    const response = await test.post("/account/unlink", {}, headers);

    expect(await response.json()).toEqual({ unlinkedPhotos: 1 });
    expect(started.accounts.owners.size).toBe(0);
  });

  it("lets the web origin send a bearer token across origins", async () => {
    const started = await start();
    test = started.test;

    const response = await fetch(`${test.url}/account`, {
      headers: {
        "access-control-request-headers": "authorization",
        "access-control-request-method": "GET",
        origin: WEB_ORIGIN,
      },
      method: "OPTIONS",
    });

    expect(response.headers.get("access-control-allow-origin")).toBe(WEB_ORIGIN);
    expect(response.headers.get("access-control-allow-headers")?.toLowerCase()).toContain(
      "authorization",
    );
  });
});
