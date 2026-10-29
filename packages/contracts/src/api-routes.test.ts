import { describe, expect, it } from "vitest";
import { API_ROUTES } from "./api-routes";
import { contractOpenApi } from "./json-schema";
import { LessonRequest } from "./lesson-api";
import { ObservationRequest, TaxonomySearchRequest } from "./taxonomy-api";

interface Operation {
  requestBody?: unknown;
  parameters?: { name: string; in: string; required: boolean }[];
}

describe("API_ROUTES", () => {
  const paths = contractOpenApi().paths as Record<string, Record<string, Operation>>;

  it("documents POST routes with a required JSON body", () => {
    for (const route of Object.values(API_ROUTES).filter((r) => r.method === "post")) {
      expect(paths[route.path]?.[route.method]).toMatchObject({ requestBody: { required: true } });
    }
  });

  it("documents GET routes with query parameters and no body", () => {
    const search = paths[API_ROUTES.searchTaxonomy.path]?.get;
    expect(search?.requestBody).toBeUndefined();
    expect(search?.parameters).toEqual([
      expect.objectContaining({ name: "q", in: "query", required: true }),
    ]);
  });

  it("trims search queries and rejects ones too short to match", () => {
    expect(TaxonomySearchRequest.parse({ q: "  bike " })).toEqual({ q: "bike" });
    expect(TaxonomySearchRequest.safeParse({ q: " b " }).success).toBe(false);
  });

  it("needs at least one observation", () => {
    expect(ObservationRequest.safeParse({}).success).toBe(false);
    expect(ObservationRequest.safeParse({ shape: "  " }).success).toBe(false);
    expect(ObservationRequest.parse({ shape: " round ", use: "" })).toEqual({
      shape: "round",
      use: "",
    });
  });

  it("trims lesson questions and defaults the reuse options", () => {
    const base = {
      taxonomyId: "home.kettle",
      audience: "general",
      readingLevel: "plain",
      locale: "en-GB",
      safetyClass: "low",
    };
    expect(LessonRequest.safeParse({ ...base, question: "  " }).success).toBe(false);
    expect(LessonRequest.safeParse({ ...base, question: "Why?" }).success).toBe(true);
    expect(LessonRequest.parse({ ...base, question: "  Why? " })).toMatchObject({
      question: "Why?",
      assumptions: [],
      fresh: false,
    });
  });
});
