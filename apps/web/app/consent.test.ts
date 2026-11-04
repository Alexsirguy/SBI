import { describe, expect, it } from "vitest";
import {
  consentChoice,
  forgetKeptPhoto,
  hasConsent,
  readConsent,
  readKeptPhotos,
  rememberKeptPhoto,
  setConsent,
  setConsents,
} from "./consent";

function memory() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

describe("consent", () => {
  it("starts with every purpose off", () => {
    const storage = memory();
    expect(readConsent(storage)).toBeUndefined();
    for (const purpose of ["save-photos", "account", "model-improvement", "research"] as const) {
      expect(hasConsent(purpose, storage)).toBe(false);
    }
  });

  it("records one purpose at a time, with the consent version and when", () => {
    const storage = memory();
    const now = new Date("2026-11-02T10:00:00.000Z");
    expect(setConsent("save-photos", true, storage, now)).toEqual({
      version: "consent-2",
      choices: { "save-photos": true },
      decidedAt: now.toISOString(),
    });
    expect(hasConsent("save-photos", storage)).toBe(true);
    expect(hasConsent("research", storage)).toBe(false);
    setConsent("save-photos", false, storage);
    expect(hasConsent("save-photos", storage)).toBe(false);
  });

  it("tells an unanswered request from a declined one, and records several at once", () => {
    const storage = memory();
    expect(consentChoice("research", storage)).toBeUndefined();
    setConsents({ research: false, "model-improvement": true }, storage);
    setConsent("save-photos", true, storage);
    expect(consentChoice("research", storage)).toBe(false);
    expect(consentChoice("model-improvement", storage)).toBe(true);
    expect(consentChoice("save-photos", storage)).toBe(true);
    expect(consentChoice("account", storage)).toBeUndefined();
  });

  it("asks again when the agreement was made under older wording", () => {
    const storage = memory();
    storage.setItem(
      "sbi.consent",
      JSON.stringify({
        version: "consent-0",
        choices: { "save-photos": true },
        decidedAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    expect(hasConsent("save-photos", storage)).toBe(false);
  });

  it("ignores a stored record it cannot read", () => {
    const storage = memory();
    storage.setItem("sbi.consent", "{not json");
    expect(hasConsent("save-photos", storage)).toBe(false);
  });

  it("lists kept photos so they can be found and deleted", () => {
    const storage = memory();
    const photo = { key: "photos/a.jpg", label: "Kettle", keptAt: "2026-11-02T10:00:00.000Z" };
    rememberKeptPhoto(photo, storage);
    rememberKeptPhoto(photo, storage);
    expect(readKeptPhotos(storage)).toEqual([photo]);
    forgetKeptPhoto("photos/a.jpg", storage);
    expect(readKeptPhotos(storage)).toEqual([]);
  });
});
