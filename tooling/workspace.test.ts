import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

const MODULES = [
  "analytics",
  "benchmark",
  "config",
  "contracts",
  "db",
  "env",
  "evidence",
  "llm",
  "media",
  "orchestrator",
  "recognition",
  "rights",
  "safety",
  "taxonomy",
  "testing",
  "tutor",
  "ui",
  "visuals",
];

function readManifest(dir: string) {
  return JSON.parse(readFileSync(join(root, dir, "package.json"), "utf8"));
}

describe("workspace layout", () => {
  it("contains exactly the planned module packages", () => {
    expect(readdirSync(join(root, "packages")).sort()).toEqual(MODULES);
  });

  it.each(MODULES)("@sbi/%s exposes a single src/index.ts entry", (name) => {
    const manifest = readManifest(`packages/${name}`);

    expect(manifest.name).toBe(`@sbi/${name}`);
    expect(manifest.exports["."]).toBe("./src/index.ts");
    expect(existsSync(join(root, "packages", name, "src/index.ts"))).toBe(true);
  });

  it.each(["web", "api"])("apps/%s is a workspace app", (name) => {
    expect(readManifest(`apps/${name}`).name).toBe(`@sbi/${name}`);
  });
});
