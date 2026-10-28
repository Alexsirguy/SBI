import base from "@sbi/config/eslint/base";

export default [
  ...base,
  // Nest modules are empty classes whose behaviour lives in their decorators.
  { rules: { "@typescript-eslint/no-extraneous-class": ["error", { allowWithDecorator: true }] } },
];
