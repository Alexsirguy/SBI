import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";

const WORKSPACE_IMPORT = /^@sbi\/([^/]+)(\/.+)?$/;
const APPS = new Set(["web", "api"]);
// Tooling configs (tsconfig, eslint, prettier) are consumed by subpath on purpose.
const SUBPATH_ALLOWED = new Set(["config"]);

const rootCache = new Map();
const exportsCache = new Map();
const REPO = resolve(import.meta.dirname, "../../../..");

// A subpath is public only when the package declares it in its `exports` map.
function isDeclaredExport(name, subpath) {
  if (!exportsCache.has(name)) {
    const manifest = resolve(REPO, "packages", name, "package.json");
    const exports = existsSync(manifest)
      ? JSON.parse(readFileSync(manifest, "utf8")).exports
      : null;
    exportsCache.set(
      name,
      new Set(exports && typeof exports === "object" ? Object.keys(exports) : []),
    );
  }
  return exportsCache.get(name).has(`.${subpath}`);
}

function packageRoot(dir) {
  if (rootCache.has(dir)) return rootCache.get(dir);
  const parent = dirname(dir);
  const root =
    existsSync(resolve(dir, "package.json")) || parent === dir ? dir : packageRoot(parent);
  rootCache.set(dir, root);
  return root;
}

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "Import workspace packages only through their public entry" },
    schema: [],
    messages: {
      internal: "Import '@sbi/{{name}}' instead of its internals ('{{source}}').",
      appImport: "Packages must not import apps ('{{source}}'); move shared code into a package.",
      relativeEscape:
        "Relative import '{{source}}' leaves this package; import the other package via '@sbi/<name>'.",
    },
  },
  create(context) {
    const file = context.filename;
    const root = packageRoot(dirname(file));
    const isPackage = basename(dirname(root)) === "packages";

    function check(node) {
      const source = node.source?.value;
      if (typeof source !== "string") return;

      const match = WORKSPACE_IMPORT.exec(source);
      if (match) {
        const name = match[1];
        if (match[2] && !SUBPATH_ALLOWED.has(name) && !isDeclaredExport(name, match[2])) {
          context.report({ node: node.source, messageId: "internal", data: { name, source } });
        }
        if (isPackage && APPS.has(name)) {
          context.report({ node: node.source, messageId: "appImport", data: { source } });
        }
        return;
      }

      if (
        source.startsWith(".") &&
        relative(root, resolve(dirname(file), source)).startsWith("..")
      ) {
        context.report({ node: node.source, messageId: "relativeEscape", data: { source } });
      }
    }

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
      ImportExpression: check,
    };
  },
};
