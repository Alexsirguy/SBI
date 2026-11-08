import { Account, CONSENT_VERSION, UNDER_EDUCATOR_AGE, UNDER_MIN_AGE } from "@sbi/contracts";
import { afterEach, describe, expect, it } from "vitest";
import {
  fakeGaps,
  fakeMedia,
  fakeRecognition,
  startTestApp,
  WEB_ORIGIN,
  type TestApp,
} from "../testing/test-app";
import { fakeAccountStore, fakeGoogle, fakeMailer, sessionFrom } from "../testing/test-auth";
import { ACCOUNT_TOKENS, ACCOUNTS, GOOGLE_VERIFIER, MAILER, SESSIONS } from "../tokens";

const ADA = {
  age: 14,
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  password: "analytical engine notes",
};
const KEY = "photos/0192f1a0-0000-7000-8000-000000000001.jpg";
const consent = (account: boolean) => ({
  choices: { account, "model-improvement": false, research: false, "save-photos": true },
  decidedAt: "2026-11-02T10:00:00.000Z",
  version: CONSENT_VERSION,
});

async function start({ google = true } = {}) {
  const store = fakeAccountStore();
  const mail = fakeMailer();
  const googleFake = await fakeGoogle();
  const test = await startTestApp(fakeMedia(), fakeRecognition(), fakeGaps(), (builder) =>
    builder
      .overrideProvider(ACCOUNTS)
      .useValue(store.accountRepo)
      .overrideProvider(SESSIONS)
      .useValue(store.sessionRepo)
      .overrideProvider(ACCOUNT_TOKENS)
      .useValue(store.tokenRepo)
      .overrideProvider(MAILER)
      .useValue(mail.send)
      .overrideProvider(GOOGLE_VERIFIER)
      .useValue(google ? googleFake.verifier : null),
  );
  const fromWeb = (cookie?: string) => ({ origin: WEB_ORIGIN, ...(cookie ? { cookie } : {}) });
  return { fromWeb, google: googleFake, mail, store, test };
}

describe("auth routes", () => {
  let test: TestApp | undefined;

  afterEach(async () => {
    await test?.app.close();
  });

  it("refuses under-13s without storing anything", async () => {
    const s = await start();
    test = s.test;

    const response = await test.post("/auth/sign-up", { ...ADA, age: 12 }, s.fromWeb());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: UNDER_MIN_AGE });
    expect(s.store.accounts.size).toBe(0);
    expect(s.mail.sent).toHaveLength(0);
  });

  it("signs up, sets an HttpOnly session cookie and emails a verification link", async () => {
    const s = await start();
    test = s.test;

    const response = await test.post(
      "/auth/sign-up",
      { ...ADA, email: " Ada@Example.com" },
      s.fromWeb(),
    );

    expect(response.status).toBe(200);
    expect(Account.parse(await response.json())).toMatchObject({
      email: "ada@example.com",
      emailVerified: false,
      firstName: "Ada",
    });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(
      /^sbi_session=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000$/,
    );
    expect(s.mail.sent[0]).toMatchObject({ subject: "Confirm your email", to: "ada@example.com" });
    expect(s.mail.sent[0]?.text).toContain(`${WEB_ORIGIN}/account/verify?token=`);
    // Only the hash of the cookie is stored.
    expect([...s.store.sessions.keys()][0]).toMatch(/^[0-9a-f]{64}$/);

    const me = await test.get("/account", { cookie: sessionFrom(response) });
    expect(Account.parse(await me.json()).email).toBe("ada@example.com");
  });

  it("refuses a taken email and a common password", async () => {
    const s = await start();
    test = s.test;
    await test.post("/auth/sign-up", ADA, s.fromWeb());

    expect((await test.post("/auth/sign-up", ADA, s.fromWeb())).status).toBe(409);
    const weak = await test.post(
      "/auth/sign-up",
      { ...ADA, email: "b@example.com", password: "password123" },
      s.fromWeb(),
    );
    expect(weak.status).toBe(400);
  });

  it("gives one message for a wrong password and an unknown email, then slows guessing", async () => {
    const s = await start();
    test = s.test;
    await test.post("/auth/sign-up", ADA, s.fromWeb());

    const wrong = await test.post(
      "/auth/sign-in",
      { email: ADA.email, password: "nope nope nope" },
      s.fromWeb(),
    );
    const unknown = await test.post(
      "/auth/sign-in",
      { email: "x@example.com", password: ADA.password },
      s.fromWeb(),
    );
    expect([wrong.status, unknown.status]).toEqual([401, 401]);
    expect(await wrong.json()).toEqual(await unknown.json());

    const right = await test.post(
      "/auth/sign-in",
      { email: ADA.email, password: ADA.password },
      s.fromWeb(),
    );
    expect(right.status).toBe(200);
    expect(right.headers.get("set-cookie")).toMatch(/^sbi_session=/);

    let last = 0;
    for (let i = 0; i < 10; i++) {
      last = (
        await test.post("/auth/sign-in", { email: ADA.email, password: "guess guess" }, s.fromWeb())
      ).status;
    }
    expect(last).toBe(429);
  });

  it("signing out ends the session and clears the cookie", async () => {
    const s = await start();
    test = s.test;
    const cookie = sessionFrom(await test.post("/auth/sign-up", ADA, s.fromWeb()));

    const out = await test.post("/auth/sign-out", {}, s.fromWeb(cookie));

    expect(out.headers.get("set-cookie")).toMatch(/^sbi_session=; .*Max-Age=0/);
    expect((await test.get("/account", { cookie })).status).toBe(401);
  });

  it("verifies an email once with the emailed link", async () => {
    const s = await start();
    test = s.test;
    const cookie = sessionFrom(await test.post("/auth/sign-up", ADA, s.fromWeb()));
    const token = s.mail.linkIn(s.mail.sent[0]);

    expect((await test.post("/auth/verify", { token }, s.fromWeb())).status).toBe(200);
    expect((await test.post("/auth/verify", { token }, s.fromWeb())).status).toBe(400);
    expect(Account.parse(await (await test.get("/account", { cookie })).json()).emailVerified).toBe(
      true,
    );
  });

  it("switches teaching tools on for a teacher once their email is confirmed", async () => {
    const s = await start();
    test = s.test;
    const teacher = { ...ADA, age: 34, role: "educator" };
    const signedUp = await test.post("/auth/sign-up", teacher, s.fromWeb());
    const cookie = sessionFrom(signedUp);
    const app = s.test;
    const account = async () => Account.parse(await (await app.get("/account", { cookie })).json());

    expect(Account.parse(await signedUp.json())).toMatchObject({
      educator: false,
      educatorPending: true,
    });
    await test.post("/auth/verify", { token: s.mail.linkIn(s.mail.sent[0]) }, s.fromWeb());
    expect(await account()).toMatchObject({ educator: true, educatorPending: false });
  });

  it("refuses teaching tools at sign-up for under-18s, by email or Google", async () => {
    const s = await start();
    test = s.test;
    const credential = await s.google.sign({ email: "grace@example.com", sub: "g-1" });

    const byEmail = await test.post("/auth/sign-up", { ...ADA, role: "educator" }, s.fromWeb());
    const byGoogle = await test.post(
      "/auth/google/finish",
      { age: 16, credential, firstName: "Grace", lastName: "Hopper", role: "educator" },
      s.fromWeb(),
    );

    expect(byEmail.status).toBe(403);
    expect(await byEmail.json()).toEqual({ error: UNDER_EDUCATOR_AGE });
    expect(byGoogle.status).toBe(403);
    expect(s.store.accounts.size).toBe(0);
  });

  it("switches teaching tools on straight away for a Google teacher", async () => {
    const s = await start();
    test = s.test;
    const credential = await s.google.sign({ email: "grace@example.com", sub: "g-1" });

    const finished = await test.post(
      "/auth/google/finish",
      { age: 40, credential, firstName: "Grace", lastName: "Hopper", role: "educator" },
      s.fromWeb(),
    );

    expect(Account.parse(await finished.json())).toMatchObject({
      educator: true,
      educatorPending: false,
    });
  });

  it("leaves a learner's account without teaching tools", async () => {
    const s = await start();
    test = s.test;

    const response = await test.post("/auth/sign-up", ADA, s.fromWeb());

    expect(Account.parse(await response.json())).toMatchObject({
      educator: false,
      educatorPending: false,
    });
  });

  it("resets a password once, signing out every session, without revealing who has an account", async () => {
    const s = await start();
    test = s.test;
    const cookie = sessionFrom(await test.post("/auth/sign-up", ADA, s.fromWeb()));

    const unknown = await test.post("/auth/forgot", { email: "nobody@example.com" }, s.fromWeb());
    const known = await test.post("/auth/forgot", { email: ADA.email }, s.fromWeb());
    expect(await unknown.json()).toEqual(await known.json());
    const reset = s.mail.sent.find((email) => email.subject === "Reset your password");
    expect(s.mail.sent.filter((email) => email.subject === "Reset your password")).toHaveLength(1);
    const token = s.mail.linkIn(reset);

    const body = { password: "a brand new phrase", token };
    expect((await test.post("/auth/reset", body, s.fromWeb())).status).toBe(200);
    expect((await test.post("/auth/reset", body, s.fromWeb())).status).toBe(400);
    expect((await test.get("/account", { cookie })).status).toBe(401);
    const old = await test.post(
      "/auth/sign-in",
      { email: ADA.email, password: ADA.password },
      s.fromWeb(),
    );
    expect(old.status).toBe(401);
    const fresh = await test.post(
      "/auth/sign-in",
      { email: ADA.email, password: "a brand new phrase" },
      s.fromWeb(),
    );
    expect(fresh.status).toBe(200);
  });

  it("refuses a cookie-carrying POST from another site", async () => {
    const s = await start();
    test = s.test;
    const cookie = sessionFrom(await test.post("/auth/sign-up", ADA, s.fromWeb()));

    const response = await test.post(
      "/account/unlink",
      {},
      { cookie, origin: "https://evil.example" },
    );

    expect(response.status).toBe(403);
  });

  it("links photos only for a verified email with the account opt-in", async () => {
    const s = await start();
    test = s.test;
    const app = s.test;
    const cookie = sessionFrom(await app.post("/auth/sign-up", ADA, s.fromWeb()));
    const link = (account: boolean) =>
      app.post("/account/link", { consent: consent(account), photoKeys: [KEY] }, s.fromWeb(cookie));

    expect((await link(true)).status).toBe(403);
    await test.post("/auth/verify", { token: s.mail.linkIn(s.mail.sent[0]) }, s.fromWeb());
    expect((await link(false)).status).toBe(400);

    const linked = await link(true);
    expect(await linked.json()).toMatchObject({ linkedPhotos: 1 });
    const unlinked = await test.post("/account/unlink", {}, s.fromWeb(cookie));
    expect(await unlinked.json()).toEqual({ unlinkedPhotos: 1 });
  });

  it("asks a new Google user for their age, then signs them in next time without asking", async () => {
    const s = await start();
    test = s.test;
    const credential = await s.google.sign({ email: "grace@example.com", sub: "g-1" });

    const first = await test.post("/auth/google", { credential }, s.fromWeb());
    expect(await first.json()).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
      status: "needs-details",
    });
    expect(first.headers.get("set-cookie")).toBeNull();

    const young = await test.post(
      "/auth/google/finish",
      { age: 11, credential, firstName: "Grace", lastName: "Hopper" },
      s.fromWeb(),
    );
    expect(young.status).toBe(403);
    expect(s.store.accounts.size).toBe(0);

    const finished = await test.post(
      "/auth/google/finish",
      { age: 15, credential, firstName: "Grace", lastName: "Hopper" },
      s.fromWeb(),
    );
    expect(Account.parse(await finished.json())).toMatchObject({
      emailVerified: true,
      firstName: "Grace",
    });

    const again = await test.post("/auth/google", { credential }, s.fromWeb());
    expect(await again.json()).toEqual({ status: "signed-in" });
    expect(again.headers.get("set-cookie")).toMatch(/^sbi_session=/);
  });

  it("joins Google to an existing email account, dropping an unverified password", async () => {
    const s = await start();
    test = s.test;
    const squatter = sessionFrom(await test.post("/auth/sign-up", ADA, s.fromWeb()));
    const credential = await s.google.sign({ email: ADA.email, sub: "g-ada" });

    const response = await test.post("/auth/google", { credential }, s.fromWeb());

    expect(await response.json()).toEqual({ status: "signed-in" });
    expect((await test.get("/account", { cookie: squatter })).status).toBe(401);
    const old = await test.post(
      "/auth/sign-in",
      { email: ADA.email, password: ADA.password },
      s.fromWeb(),
    );
    expect(old.status).toBe(401);
  });

  it("refuses Google tokens for another app or with an unverified email", async () => {
    const s = await start();
    test = s.test;

    for (const credential of [
      await s.google.sign({ email: "a@example.com", sub: "g" }, { audience: "other-app" }),
      await s.google.sign({ email: "a@example.com", email_verified: false, sub: "g" }),
    ]) {
      expect((await test.post("/auth/google", { credential }, s.fromWeb())).status).toBe(401);
    }
  });

  it("says Google sign-in is unavailable without a client id", async () => {
    const s = await start({ google: false });
    test = s.test;

    const credential = await s.google.sign({ email: "a@example.com", sub: "g" });
    expect((await test.post("/auth/google", { credential }, s.fromWeb())).status).toBe(503);
  });

  it("lets only the web origin send cookies across origins", async () => {
    const s = await start();
    test = s.test;

    const response = await fetch(`${test.url}/auth/sign-in`, {
      headers: {
        "access-control-request-headers": "content-type",
        "access-control-request-method": "POST",
        origin: WEB_ORIGIN,
      },
      method: "OPTIONS",
    });

    expect(response.headers.get("access-control-allow-origin")).toBe(WEB_ORIGIN);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("keeps a reset link usable when the new password is refused", async () => {
    const s = await start();
    test = s.test;
    await test.post("/auth/sign-up", ADA, s.fromWeb());
    await test.post("/auth/forgot", { email: ADA.email }, s.fromWeb());
    const token = s.mail.linkIn(
      s.mail.sent.find((email) => email.subject === "Reset your password"),
    );

    const weak = await test.post("/auth/reset", { password: "password123", token }, s.fromWeb());
    expect(weak.status).toBe(400);
    const good = await test.post(
      "/auth/reset",
      { password: "a sturdier phrase", token },
      s.fromWeb(),
    );
    expect(good.status).toBe(200);
  });

  it("treats a garbled session cookie as signed out instead of failing", async () => {
    const s = await start();
    test = s.test;

    const response = await test.get("/account", { cookie: "sbi_session=%zz" });

    expect(response.status).toBe(401);
  });
});
