import { z } from "zod";

export const PlaygroundSpec = z.object({
  /** A script that calls kit.onFrame((ctx, state) => …) and draws on a 2D canvas, nothing else. */
  code: z.string().min(1).max(20_000),
});
export type PlaygroundSpec = z.infer<typeof PlaygroundSpec>;

// Names that reach past the canvas: globals, the DOM, timers, the network and object internals.
// The sandbox and CSP stop these too; refusing them here gives the AI a reason it can act on.
const FORBIDDEN = new Set([
  "window",
  "self",
  "globalThis",
  "document",
  "parent",
  "top",
  "opener",
  "frames",
  "location",
  "navigator",
  "history",
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "Worker",
  "SharedWorker",
  "importScripts",
  "eval",
  "Function",
  "setTimeout",
  "setInterval",
  "requestAnimationFrame",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "caches",
  "cookieStore",
  "postMessage",
  "open",
  "close",
  "alert",
  "confirm",
  "prompt",
  "Image",
  "Audio",
  "ownerDocument",
  "defaultView",
  "canvas",
  "constructor",
  "__proto__",
  "prototype",
  "getPrototypeOf",
  "Reflect",
  "Proxy",
  "WebAssembly",
  "crypto",
  "import",
]);
const FORBIDDEN_NODES = new Set([
  "ImportExpression",
  "MetaProperty",
  "ImportDeclaration",
  "ExportNamedDeclaration",
  "ExportDefaultDeclaration",
  "WithStatement",
]);

interface Node {
  type: string;
  [key: string]: unknown;
}

function walk(node: unknown, visit: (node: Node) => void): void {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
    return;
  }
  if (node === null || typeof node !== "object" || typeof (node as Node).type !== "string") return;
  visit(node as Node);
  for (const [key, value] of Object.entries(node)) {
    if (key !== "type" && key !== "start" && key !== "end") walk(value, visit);
  }
}

/** Problems with playground code, worded for the AI's repair attempt. */
export async function playgroundCodeProblems(code: string): Promise<string[]> {
  const { parse } = await import("acorn");
  let program: unknown;
  try {
    program = parse(code, { ecmaVersion: 2022, sourceType: "script" });
  } catch (error) {
    return [`the code does not parse: ${(error as Error).message}`];
  }
  const found = new Set<string>();
  let callsOnFrame = false;
  walk(program, (node) => {
    if (FORBIDDEN_NODES.has(node.type)) found.add(node.type);
    if (node.type === "Identifier" && FORBIDDEN.has(node.name as string))
      found.add(node.name as string);
    if (node.type === "Literal" && typeof node.value === "string" && FORBIDDEN.has(node.value)) {
      found.add(node.value);
    }
    if (node.type === "CallExpression") {
      const callee = node.callee as Node;
      const object = callee.object as Node | undefined;
      const property = callee.property as Node | undefined;
      if (
        callee.type === "MemberExpression" &&
        object?.name === "kit" &&
        property?.name === "onFrame"
      ) {
        callsOnFrame = true;
      }
    }
  });
  const problems = [...found].map(
    (name) => `the code may not use ${name}; draw only with ctx and kit`,
  );
  if (!callsOnFrame) problems.push("the code must call kit.onFrame((ctx, state) => { … })");
  return problems;
}
