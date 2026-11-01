// Serves MediaPipe's WebAssembly from this site, so face blurring needs no third-party CDN (ADR 0018).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
// The package exports each wasm file by name, so they resolve without reaching into its folders.
const resolve = (name) => require.resolve(`@mediapipe/tasks-vision/${name}`);
const target = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "mediapipe", "wasm");
mkdirSync(target, { recursive: true });
for (const name of [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
]) {
  copyFileSync(resolve(name), join(target, name));
}
