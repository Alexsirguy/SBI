import base from "@sbi/config/eslint/base";

// Workspaces lint themselves via turbo; the root only covers repo-level files.
export default [{ ignores: ["apps/**", "packages/**"] }, ...base];
