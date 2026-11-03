import { describe, expect, it } from "vitest";
import { retrieveClaims } from "./retrieve";
import { BOILING, CLAIMS, ELEMENT, PRESSURE } from "./test-lesson";

describe("retrieveClaims", () => {
  it("puts the claims that share words with the question first", () => {
    const found = retrieveClaims(CLAIMS, "What does lower air pressure do to boiling?", [], 2);
    expect(found.map((claim) => claim.text)).toEqual([PRESSURE.text, BOILING.text]);
  });

  it("fills a vague follow-up with the lesson's claims in order", () => {
    expect(retrieveClaims(CLAIMS, "Why?", [], 3)).toEqual(CLAIMS.slice(0, 3));
  });

  it("lets the last exchange steer a follow-up that names nothing", () => {
    const found = retrieveClaims(CLAIMS, "And then?", [{ userText: "What switches it off?" }], 1);
    expect(found[0]?.text).toContain("switches");
  });

  it("matches words regardless of accents", () => {
    const claims = [ELEMENT, { ...BOILING, text: "El agua hierve a menor presión en la montaña." }];
    expect(retrieveClaims(claims, "¿Por qué la presion cambia?", [], 1)[0]).toBe(claims[1]);
  });
});
