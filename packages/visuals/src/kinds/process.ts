import { kindRenderer } from "../kind";

// Mermaid is close to 1 MB, so it loads only when the learner asks for the diagram (ADR 0014).
export const processRenderer = kindRenderer({
  kind: "process",
  loadOnTap: "Show the diagram",
  async draw(manifest, stage) {
    const { default: mermaid } = await import("mermaid");
    const dark = stage.ownerDocument.defaultView?.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: dark ? "dark" : "neutral",
      flowchart: { htmlLabels: false },
    });
    const { svg } = await mermaid.render(`process-${manifest.visualId}`, String(manifest.spec));
    const holder = stage.ownerDocument.createElement("div");
    holder.className = "visual-process";
    // Strict mode has already sanitised the SVG, and the spec was checked for links and HTML.
    holder.innerHTML = svg;
    const drawn = holder.querySelector("svg");
    drawn?.setAttribute("role", "img");
    drawn?.setAttribute("aria-label", manifest.alt);
    stage.append(holder);
    return { destroy: () => holder.remove() };
  },
});

export default processRenderer;
