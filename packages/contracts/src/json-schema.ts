import { z } from "zod";
import { API_ROUTES, ApiError } from "./media-api";
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

function inlineSchema(schema: z.ZodType, io: "input" | "output"): JsonObject {
  const inline: JsonObject = { ...z.toJSONSchema(schema, { io, target: "draft-2020-12" }) };
  delete inline.$schema;
  return inline;
}

function json(schema: JsonObject) {
  return { content: { "application/json": { schema } } };
}

function apiPaths(): JsonObject {
  const error = json(inlineSchema(ApiError, "output"));
  const paths: Record<string, JsonObject> = {};
  for (const [operationId, route] of Object.entries(API_ROUTES)) {
    paths[route.path] = {
      [route.method]: {
        operationId,
        summary: route.summary,
        requestBody: { required: true, ...json(inlineSchema(route.request, "input")) },
        responses: {
          200: { description: "OK", ...json(inlineSchema(route.response, "output")) },
          ...Object.fromEntries(
            route.errors.map((status) => [status, { description: "Error", ...error }]),
          ),
        },
      },
    };
  }
  return paths;
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
    paths: apiPaths(),
    components: { schemas },
  };
}
