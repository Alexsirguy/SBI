import { AccountExport, DeletedAccount } from "@sbi/contracts";
import { afterEach, describe, expect, it } from "vitest";
import {
  fakeGaps,
  fakeMedia,
  fakeRecognition,
  startTestApp,
  WEB_ORIGIN,
  type TestApp,
} from "../testing/test-app";
import { fakeAccountStore, fakeSavedLessons, sessionFrom } from "../testing/test-auth";
import { ACCOUNT_TOKENS, ACCOUNTS, SAVED_LESSONS, SESSIONS } from "../tokens";

const FILE = "0192f1a0-0000-7000-8000-000000000001.jpg";
const KEY = `photos/${FILE}`;
const ADA = {
  age: 14,
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  password: "analytical engine notes",
};
const LESSON = "0192f1a0-0000-7000-8000-0000000000c1";

async function start() {
  const store = fakeAccountStore();
  const saved = fakeSavedLessons();
  // The real delete clears saved lessons in the same transaction (see the MariaDB tests).
  const deleteAccount = store.accountRepo.delete;
  store.accountRepo.delete = async (accountId) => {
    for (const key of saved.rows.keys())
      if (key.startsWith(`${accountId} `)) saved.rows.delete(key);
    await deleteAccount(accountId);
  };
  const media = fakeMedia();
  const test = await startTestApp(media, fakeRecognition(), fakeGaps(), (builder) =>
    builder
      .overrideProvider(ACCOUNTS)
      .useValue(store.accountRepo)
      .overrideProvider(SESSIONS)
      .useValue(store.sessionRepo)
      .overrideProvider(ACCOUNT_TOKENS)
      .useValue(store.tokenRepo)
      .overrideProvider(SAVED_LESSONS)
      .useValue(saved.repository),
  );
  const signUp = async (email: string) => {
    const response = await test.post("/auth/sign-up", { ...ADA, email }, { origin: WEB_ORIGIN });
    const account = (await response.json()) as { accountId: string };
    return {
      accountId: account.accountId,
      headers: { cookie: sessionFrom(response), origin: WEB_ORIGIN },
    };
  };
  const ada = await signUp(ADA.email);
  // A kept photo linked to Ada, with its bytes in storage.
  media.records.push({ createdAt: new Date(), expiresAt: null, key: KEY, kind: "original" });
  media.objects.set(KEY, new Uint8Array([1, 2, 3]));
  store.owners.set(KEY, ada.accountId);
  await saved.repository.save(ada.accountId, {
    lessonId: LESSON,
    savedAt: new Date("2026-11-03T09:00:00Z"),
    title: "Kettles",
    version: 2,
  });
  return { ada, media, saved, signUp, store, test };
}

describe("account export and deletion", () => {
  let test: TestApp | undefined;

  afterEach(async () => {
    await test?.app.close();
  });

  it("exports everything tied to the account, with a download for each photo", async () => {
    const s = await start();
    test = s.test;

    const bundle = AccountExport.parse(
      await (await test.get("/account/export", s.ada.headers)).json(),
    );

    expect(bundle.account).toMatchObject({
      ageAtSignup: 14,
      email: "ada@example.com",
      firstName: "Ada",
      signInMethods: ["password"],
    });
    expect(bundle.savedLessons).toEqual([
      { lessonId: LESSON, savedAt: "2026-11-03T09:00:00.000Z", title: "Kettles", version: 2 },
    ]);
    expect(bundle.photos).toEqual([
      { consentVersion: "consent-1", download: `/account/photos/${FILE}`, key: KEY },
    ]);
    expect(bundle.notes.length).toBeGreaterThan(0);
  });

  it("downloads a photo only for the account it belongs to", async () => {
    const s = await start();
    test = s.test;
    const grace = await s.signUp("grace@example.com");

    const mine = await test.get(`/account/photos/${FILE}`, s.ada.headers);
    expect(mine.status).toBe(200);
    expect(mine.headers.get("content-type")).toBe("image/jpeg");
    expect(new Uint8Array(await mine.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));

    expect((await test.get(`/account/photos/${FILE}`, grace.headers)).status).toBe(404);
    expect((await test.get("/account/photos/..%2F..%2Fsecret", s.ada.headers)).status).toBe(404);
    expect((await test.get(`/account/photos/${FILE}`)).status).toBe(401);
  });

  it("deletes nothing unless the typed email matches", async () => {
    const s = await start();
    test = s.test;

    const response = await test.post(
      "/account/delete",
      { email: "someone@example.com" },
      s.ada.headers,
    );

    expect(response.status).toBe(400);
    expect(s.media.objects.has(KEY)).toBe(true);
    expect((await test.get("/account", s.ada.headers)).status).toBe(200);
  });

  it("deletes the photos' bytes, saved lessons, sessions and the account itself", async () => {
    const s = await start();
    test = s.test;

    const response = await test.post(
      "/account/delete",
      { email: " ADA@example.com " },
      s.ada.headers,
    );

    expect(DeletedAccount.parse(await response.json())).toEqual({ deletedPhotos: [KEY] });
    expect(response.headers.get("set-cookie")).toMatch(/^sbi_session=; .*Max-Age=0/);
    expect(s.media.objects.has(KEY)).toBe(false);
    expect(s.media.audit).toEqual([
      expect.objectContaining({ key: KEY, reason: "deleted at the learner's request" }),
    ]);
    expect(await s.saved.repository.list(s.ada.accountId)).toEqual([]);
    expect(s.store.accounts.has(s.ada.accountId)).toBe(false);
    expect((await test.get("/account", s.ada.headers)).status).toBe(401);
    const again = await test.post(
      "/auth/sign-in",
      { email: ADA.email, password: ADA.password },
      { origin: WEB_ORIGIN },
    );
    expect(again.status).toBe(401);
  });

  it("keeps the account when its photos cannot be deleted, so the learner can try again", async () => {
    const s = await start();
    test = s.test;
    s.media.storage.remove = async () => {
      throw new Error("storage down");
    };

    const response = await test.post("/account/delete", { email: ADA.email }, s.ada.headers);

    expect(response.status).toBe(502);
    expect(s.store.accounts.has(s.ada.accountId)).toBe(true);
    expect((await test.get("/account", s.ada.headers)).status).toBe(200);
  });
});
