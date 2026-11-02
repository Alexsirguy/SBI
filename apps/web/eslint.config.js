import next from "@sbi/config/eslint/next";

// Copied from @mediapipe/tasks-vision on dev and build; vendor code, not ours to lint.
export default [{ ignores: ["public/mediapipe/wasm/**"] }, ...next];
