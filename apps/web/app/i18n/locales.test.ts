import { describe, expect, it } from "vitest";
import { format } from "./format";
import { localeFromHeader } from "./locales";

describe("localeFromHeader", () => {
  it("picks the most preferred supported language", () => {
    expect(localeFromHeader("es-MX,es;q=0.9,en;q=0.8")).toBe("es");
    expect(localeFromHeader("fr-FR,fr;q=0.9,en;q=0.5,es;q=0.4")).toBe("en");
    expect(localeFromHeader("de")).toBe("en");
    expect(localeFromHeader(undefined)).toBe("en");
  });
});

describe("format", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    expect(format("Saved {date}", { date: "3 Nov" })).toBe("Saved 3 Nov");
    expect(format("Hi {name}", {})).toBe("Hi {name}");
  });
});
