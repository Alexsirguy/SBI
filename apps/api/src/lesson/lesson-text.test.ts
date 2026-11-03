import { describe, expect, it } from "vitest";
import { safetyNoticeFor } from "./lesson.service";
import { lessonText, SAFETY_NOTICES_ES } from "./lesson-text";

describe("lessonText", () => {
  it("writes the service's own lines in Spanish for es requests", () => {
    expect(lessonText("es").checking).toBe("Comprobando cada sección con sus fuentes.");
    expect(lessonText("es").writingMixed(3, 2)).toMatch(/^Escribiendo la lección a partir de 3/);
    expect(lessonText("en-GB").checking).toBe("Checking every section against its sources.");
    // Research questions are English, so Spanish progress gives only their number.
    expect(lessonText("es").researchingCount(3)).toBe("Investigando 3 preguntas.");
    expect(lessonText("es").retry).toMatch(/^Ahora mismo no pudimos/);
  });

  it("gives the catalogue's safety notices in Spanish, falling back to the category", () => {
    expect(safetyNoticeFor({ id: "object.mushroom" }, undefined, "es")).toBe(
      SAFETY_NOTICES_ES["object.mushroom"],
    );
    expect(safetyNoticeFor({ id: "object.kettle" }, { categories: ["medical"] }, "es")).toMatch(
      /^Salud y medicamentos/,
    );
    expect(safetyNoticeFor({ id: "object.mushroom" })).toMatch(/^Wild mushrooms/);
  });
});
