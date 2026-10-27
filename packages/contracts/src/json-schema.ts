import { z } from "zod";
import { CONTRACT_SCHEMAS, CONTRACTS_VERSION } from "./registry";

type JsonObject = Record<string, unknown>;

// Cross-field refinements are enforced by Zod at runtime; JSON Schema carries the field rules.
export function contractJsonSchemas(): Record<string, JsonObject> {
  return Object.fromEntries(
    Object.entries(CONTRACT_SCHEMAS).map(([name, schema]) => [
      name,
      { $id: `${name}.schema.json`, ...z.toJSONSchema(schema, { target: "draft-2020-12" }) },
    ]),
  );
}

export function contractOpenApi(): JsonObject {
  const schemas = Object.fromEntries(
    Object.entries(contractJsonSchemas()).map(
      ([name, { $schema: _schema, $id: _id, ...schema }]) => [name, schema],
    ),
  );
  return {
    openapi: "3.1.0",
    info: { title: "Science Behind It contracts", version: CONTRACTS_VERSION },
    paths: {},
    components: { schemas },
  };
}
