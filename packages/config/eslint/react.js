import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import base from "./base.js";

export default [
  ...base,
  reactHooks.configs.flat.recommended,
  { languageOptions: { globals: globals.browser } },
];
