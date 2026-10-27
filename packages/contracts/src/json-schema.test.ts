import { describe, expect, it } from "vitest";
import { contractJsonSchemas, contractOpenApi } from "./json-schema";
import { CONTRACT_SCHEMAS, CONTRACTS_VERSION } from "./registry";

describe("contract JSON Schema generation", () => {
  it("emits one draft 2020-12 schema per registered contract", () => {
    const schemas = contractJsonSchemas();

    expect(Object.keys(schemas).sort()).toEqual(Object.keys(CONTRACT_SCHEMAS).sort());
    for (const schema of Object.values(schemas)) {
      expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    }
  });

  it("keeps field-level rules such as enums and required fields", () => {
    const claim = contractJsonSchemas().Claim as {
      required: string[];
      properties: { status: { enum: string[] } };
    };

    expect(claim.required).toContain("claimId");
    expect(claim.properties.status.enum).toEqual([
      "supported",
      "qualified",
      "disputed",
      "unsupported",
    ]);
  });

  it("publishes OpenAPI components at the contracts version", () => {
    const openApi = contractOpenApi() as {
      info: { version: string };
      components: { schemas: Record<string, object> };
    };

    expect(openApi.info.version).toBe(CONTRACTS_VERSION);
    expect(Object.keys(openApi.components.schemas)).toContain("Lesson");
    expect(JSON.stringify(openApi.components.schemas)).not.toContain('"$schema"');
  });
});
