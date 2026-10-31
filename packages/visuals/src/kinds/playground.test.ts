import { describe, expect, it } from "vitest";
import { KIT_SOURCE, playgroundDocument } from "./playground-kit";
import { playgroundCodeProblems } from "./playground-spec";
import { RAINBOW_CODE } from "./rainbow";

describe("playgroundCodeProblems", () => {
  it("accepts drawing code that only uses ctx, state and kit", async () => {
    expect(await playgroundCodeProblems(RAINBOW_CODE)).toEqual([]);
  });

  it.each([
    ["the network", "fetch('/x'); kit.onFrame(() => {});", "fetch"],
    ["the document", "kit.onFrame(() => { document.title = 'x'; });", "document"],
    ["the page around the frame", "kit.onFrame(() => parent.postMessage(1, '*'));", "parent"],
    ["the canvas element", "kit.onFrame((ctx) => ctx.canvas.ownerDocument);", "canvas"],
    ["a computed way to the canvas", "kit.onFrame((ctx) => ctx['canvas']);", "canvas"],
    ["eval", "kit.onFrame(() => eval('1'));", "eval"],
    [
      "the constructor escape",
      "kit.onFrame(() => ({}).constructor.constructor('return this')());",
      "constructor",
    ],
    ["timers", "setTimeout(() => {}, 1); kit.onFrame(() => {});", "setTimeout"],
    ["navigation", "kit.onFrame(() => { location.href = 'https://x.example'; });", "location"],
    ["dynamic import", "kit.onFrame(() => import('https://x.example/a.js'));", "ImportExpression"],
  ])("refuses code that reaches %s", async (_case, code, name) => {
    expect(await playgroundCodeProblems(code)).toContain(
      `the code may not use ${name}; draw only with ctx and kit`,
    );
  });

  it("needs a frame function and code that parses", async () => {
    expect(await playgroundCodeProblems("const a = 1;")).toEqual([
      "the code must call kit.onFrame((ctx, state) => { … })",
    ]);
    expect((await playgroundCodeProblems("kit.onFrame(() => {")).join()).toMatch(/does not parse/);
  });
});

async function sha256Base64(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

describe("playgroundDocument", () => {
  it("allows exactly its two scripts, and no network, eval, forms or base URL", async () => {
    const { html, csp: header } = await playgroundDocument("kit.onFrame(() => {});", {
      frameAncestors: ["https://sbi.example"],
    });
    const csp = /content="([^"]+)"/.exec(html)?.[1] ?? "";
    expect(header).toContain("sandbox allow-scripts");
    expect(header).toContain("frame-ancestors https://sbi.example");
    expect(header.startsWith(csp)).toBe(true);
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).not.toMatch(/unsafe-eval|connect-src/);
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
      (match) => match[1] ?? "",
    );
    expect(scripts[0]).toBe(KIT_SOURCE);
    const allowed = [...csp.matchAll(/'sha256-([^']+)'/g)].map((match) => match[1]);
    expect(allowed).toEqual(await Promise.all(scripts.map(sha256Base64)));
  });

  it("keeps code that mentions a closing script tag inside its own script", async () => {
    const { html } = await playgroundDocument('kit.onFrame(() => "</script><img src=x>");');
    expect(html.match(/<\/script>/g)).toHaveLength(2);
  });
});
