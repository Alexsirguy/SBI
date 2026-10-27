import { RuleTester } from "eslint";
import { describe, it } from "vitest";
import rule from "./max-comment-lines.js";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester();

tester.run("max-comment-lines", rule, {
  valid: [
    "// Retries cover transient provider timeouts.\nconst a = 1;",
    "// First line of why.\n// Second line of why.\nconst a = 1;",
    "/** Builds the lesson request. */\nexport function build() {}",
    "/**\n * Builds the lesson request.\n */\nexport function build() {}",
    "// One thought.\nconst a = 1;\n// Another thought.\nconst b = 2;",
    "// TODO(#42): replace with provider adapter.\nconst a = 1;",
    "/* eslint-disable no-console */\nconsole.log(1);",
    { code: "// a\n// b\n// c\nconst a = 1;", options: [{ max: 3 }] },
  ],
  invalid: [
    {
      code: "// one\n// two\n// three\nconst a = 1;",
      errors: [{ messageId: "tooLong", data: { lines: 3, max: 2 } }],
    },
    {
      code: "/*\n * Paragraph one.\n *\n * Paragraph two.\n * More detail.\n */\nconst a = 1;",
      errors: [{ messageId: "tooLong", data: { lines: 3, max: 2 } }],
    },
    {
      code: "// TODO: fix later\nconst a = 1;",
      errors: [{ messageId: "todoNeedsIssue" }],
    },
    {
      code: "// FIXME handle errors\nconst a = 1;",
      errors: [{ messageId: "todoNeedsIssue" }],
    },
  ],
});
