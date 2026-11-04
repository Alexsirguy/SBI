import base from "@sbi/config/eslint/base";

// The one package allowed to talk to Mixpanel, behind its schema and payload guard.
export default [...base, { files: ["src/mixpanel.ts"], rules: { "no-restricted-imports": "off" } }];
