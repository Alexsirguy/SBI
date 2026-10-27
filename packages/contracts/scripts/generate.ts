import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { contractJsonSchemas, contractOpenApi } from "../src/json-schema";

const outDir = join(import.meta.dirname, "../generated");
const check = process.argv.includes("--check");

const files = new Map<string, string>(
  [["openapi.json", contractOpenApi()]]
    .concat(
      Object.entries(contractJsonSchemas()).map(([name, schema]) => [
        `json-schema/${name}.schema.json`,
        schema,
      ]),
    )
    .map(([path, value]) => [path as string, `${JSON.stringify(value, null, 2)}\n`]),
);

function existingFiles(): string[] {
  try {
    return [
      "openapi.json",
      ...readdirSync(join(outDir, "json-schema")).map((file) => `json-schema/${file}`),
    ];
  } catch {
    return [];
  }
}

if (check) {
  const stale = [...files].filter(([path, content]) => {
    try {
      return readFileSync(join(outDir, path), "utf8") !== content;
    } catch {
      return true;
    }
  });
  const extra = existingFiles().filter((path) => !files.has(path));
  if (stale.length > 0 || extra.length > 0) {
    console.error("Generated contracts are stale. Run `pnpm --filter @sbi/contracts generate`.");
    for (const [path] of stale) console.error(`  changed: ${path}`);
    for (const path of extra) console.error(`  extra:   ${path}`);
    process.exit(1);
  }
  console.log(`Generated contracts are up to date (${files.size} files).`);
} else {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, "json-schema"), { recursive: true });
  for (const [path, content] of files) writeFileSync(join(outDir, path), content);
  console.log(`Wrote ${files.size} files to generated/.`);
}
