import { resolve } from "node:path";
import { RuleTester } from "eslint";
import { describe, it } from "vitest";
import rule from "./no-cross-package-internals.js";

RuleTester.describe = describe;
RuleTester.it = it;

const repo = resolve(import.meta.dirname, "../../../..");
const inLlm = resolve(repo, "packages/llm/src/adapters/provider.ts");
const inApi = resolve(repo, "apps/api/src/routes/lesson.ts");

const tester = new RuleTester();

tester.run("no-cross-package-internals", rule, {
  valid: [
    { code: 'import { x } from "@sbi/contracts";', filename: inLlm },
    { code: 'import { x } from "../index.js";', filename: inLlm },
    { code: 'import base from "@sbi/config/eslint/base";', filename: inLlm },
    { code: 'import { x } from "@sbi/orchestrator";', filename: inApi },
    { code: 'import { x } from "../app.js";', filename: inApi },
    { code: 'import { z } from "zod/mini";', filename: inLlm },
  ],
  invalid: [
    {
      code: 'import { x } from "@sbi/contracts/src/lesson";',
      filename: inLlm,
      errors: [{ messageId: "internal" }],
    },
    {
      code: 'export * from "@sbi/evidence/src/claims.js";',
      filename: inApi,
      errors: [{ messageId: "internal" }],
    },
    {
      code: 'import { x } from "@sbi/api";',
      filename: inLlm,
      errors: [{ messageId: "appImport" }],
    },
    {
      code: 'import { x } from "../../../evidence/src/index.js";',
      filename: inLlm,
      errors: [{ messageId: "relativeEscape" }],
    },
    {
      code: 'const m = await import("@sbi/tutor/src/pipeline.js");',
      filename: inApi,
      errors: [{ messageId: "internal" }],
    },
  ],
});
