import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Walks the relative imports reachable from the browser entry and collects their bare specifiers.
function bareImports(file: string, seen = new Set<string>()): Set<string> {
  const found = new Set<string>();
  if (seen.has(file)) return found;
  seen.add(file);
  const source = readFileSync(file, "utf8");
  for (const [, specifier] of source.matchAll(/from\s+"([^"]+)"/g)) {
    if (!specifier) continue;
    if (specifier.startsWith(".")) {
      for (const nested of bareImports(join(file, "..", `${specifier}.ts`), seen))
        found.add(nested);
    } else {
      found.add(specifier);
    }
  }
  return found;
}

describe("browser entry", () => {
  it("pulls in no Node built-ins or server SDKs", () => {
    const imports = [...bareImports(join(import.meta.dirname, "browser.ts"))];

    expect(
      imports.filter((name) => name.startsWith("node:") || name.startsWith("@aws-sdk")),
    ).toEqual([]);
  });
});
