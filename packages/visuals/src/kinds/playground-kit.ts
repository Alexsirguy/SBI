// Runs inside the sandboxed frame. It owns the canvas and hands the AI's code a context that
// cannot reach the canvas element, and so cannot reach the document either.
export const KIT_SOURCE = `(() => {
  "use strict";
  const canvas = document.getElementById("stage");
  const context = canvas.getContext("2d");
  let draw = null;
  let values = Object.freeze({});
  let playing = true;
  let failed = false;
  let time = 0;
  let last = 0;
  const send = (message) => parent.postMessage(message, "*");
  const fail = (error) => {
    if (failed) return;
    failed = true;
    send({ type: "error", message: String((error && error.message) || error).slice(0, 200) });
  };
  const ctx = new Proxy(context, {
    get(target, key) {
      if (key === "canvas") return undefined;
      const value = target[key];
      return typeof value === "function" ? value.bind(target) : value;
    },
    set(target, key, value) {
      if (key !== "canvas") target[key] = value;
      return true;
    },
  });
  function size() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(innerWidth * ratio);
    canvas.height = Math.round(innerHeight * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  function paint(dt) {
    if (!draw || failed) return;
    try {
      context.save();
      context.clearRect(0, 0, innerWidth, innerHeight);
      draw(ctx, Object.freeze({ width: innerWidth, height: innerHeight, time, dt, values }));
      context.restore();
    } catch (error) {
      fail(error);
    }
  }
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    if (playing) {
      time += dt;
      paint(dt);
    }
    requestAnimationFrame(tick);
  }
  const colors = Object.freeze({
    ink: "#142a33", soft: "#4d6470", action: "#0b6a64", marker: "#ffd84d",
    caution: "#a63a1f", note: "#2a5a86", paper: "#ffffff", sky: "#cfe3f5",
  });
  self.kit = Object.freeze({
    colors,
    onFrame(fn) {
      if (typeof fn === "function") draw = fn;
    },
    marker(c, number, x, y) {
      c.save();
      c.beginPath();
      c.arc(x, y, 11, 0, Math.PI * 2);
      c.fillStyle = colors.paper;
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = colors.ink;
      c.stroke();
      c.fillStyle = colors.ink;
      c.font = "bold 12px system-ui, sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(String(number), x, y + 0.5);
      c.restore();
    },
    arrow(c, x1, y1, x2, y2, color) {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      c.save();
      c.strokeStyle = c.fillStyle = color || colors.ink;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();
      c.beginPath();
      c.moveTo(x2, y2);
      c.lineTo(x2 - 10 * Math.cos(angle - 0.4), y2 - 10 * Math.sin(angle - 0.4));
      c.lineTo(x2 - 10 * Math.cos(angle + 0.4), y2 - 10 * Math.sin(angle + 0.4));
      c.closePath();
      c.fill();
      c.restore();
    },
  });
  addEventListener("message", (event) => {
    if (event.source !== parent) return;
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.values && typeof data.values === "object") values = Object.freeze({ ...data.values });
    if (typeof data.playing === "boolean") playing = data.playing;
    if (!playing) paint(0);
  });
  addEventListener("resize", () => {
    size();
    paint(0);
  });
  addEventListener("error", (event) => fail(event.error || event.message));
  addEventListener("load", () => {
    if (!draw) return fail("the code never called kit.onFrame");
    size();
    paint(0);
    if (!failed) send({ type: "ready" });
    requestAnimationFrame(tick);
  });
})();`;

async function sha256Base64(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

export interface PlaygroundDocument {
  html: string;
  /** For the HTTP header, which can also sandbox the document and say who may frame it. */
  csp: string;
}

/** The frame document; its CSP allows only these two scripts, so no eval and no network. */
export async function playgroundDocument(
  code: string,
  { frameAncestors = [] }: { frameAncestors?: readonly string[] } = {},
): Promise<PlaygroundDocument> {
  // Only a closing script tag could end the code early; the hash covers the escaped text.
  const user = `(function (kit) {\n"use strict";\n${code}\n})(self.kit);`.replace(
    /<\/script/gi,
    "<\\/script",
  );
  const hashes = await Promise.all([KIT_SOURCE, user].map(sha256Base64));
  const policy = [
    "default-src 'none'",
    `script-src ${hashes.map((hash) => `'sha256-${hash}'`).join(" ")}`,
    "style-src 'unsafe-inline'",
    "img-src data:",
    "form-action 'none'",
    "base-uri 'none'",
  ];
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy.join("; ")}">
<style>html,body{margin:0;height:100%;overflow:hidden;background:transparent}canvas{display:block;width:100%;height:100%}</style>
</head><body><canvas id="stage"></canvas><script>${KIT_SOURCE}</script><script>${user}</script></body></html>`;
  const header = [
    ...policy,
    // Meta tags cannot sandbox or limit framing, so the header adds both.
    "sandbox allow-scripts",
    `frame-ancestors ${frameAncestors.length > 0 ? frameAncestors.join(" ") : "'none'"}`,
  ];
  return { html, csp: header.join("; ") };
}
