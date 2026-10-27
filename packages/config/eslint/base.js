import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";
import local from "./plugin.js";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/.next/**", "**/.turbo/**", "**/coverage/**", "**/next-env.d.ts"] },
  js.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  {
    languageOptions: { globals: globals.node },
    plugins: { local },
    rules: {
      "local/max-comment-lines": "error",
      "local/no-cross-package-internals": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  prettier,
);
