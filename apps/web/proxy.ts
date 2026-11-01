import { NextResponse, type NextRequest } from "next/server";

/** The lesson's policy: only our scripts, the API for data and playground frames, and no eval. */
export function lessonCsp(nonce: string, apiUrl: string): string {
  const api = new URL(apiUrl).origin;
  return [
    "default-src 'self'",
    // MuJoCo's Emscripten bindings build functions at run time, so eval is allowed (ADR 0014);
    // the nonce and strict-dynamic still refuse any script the page did not load itself.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval' 'unsafe-eval'`,
    // Mermaid and Vega write style elements and attributes as they draw.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${api}`,
    `frame-src ${api}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = lessonCsp(nonce, process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");
  // Next reads the nonce from the request's policy and puts it on its own scripts.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

// The pages that draw generated visuals; capture keeps its own flow to storage for now.
export const config = { matcher: ["/lesson", "/visuals"] };
