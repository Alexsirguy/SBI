import { kindRenderer } from "../kind";
import { stackedFlowchart } from "./process-spec";

// Below this share of its natural size the stage names are too small to read, so the row becomes a column.
const MIN_SCALE = 0.75;

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
    const holder = stage.ownerDocument.createElement("div");
    holder.className = "visual-process";
    stage.append(holder);
    const spec = String(manifest.spec);
    const render = async (text: string) => {
      const { svg } = await mermaid.render(`process-${manifest.visualId}`, text);
      // Strict mode has already sanitised the SVG, and the spec was checked for links and HTML.
      holder.innerHTML = svg;
      return holder.querySelector("svg");
    };
    let drawn = await render(spec);
    const natural = drawn?.viewBox.baseVal.width ?? 0;
    if (natural * MIN_SCALE > holder.clientWidth && stackedFlowchart(spec) !== spec) {
      drawn = await render(stackedFlowchart(spec));
    }
    // A diagram still too wide scrolls sideways in its box rather than shrinking past readable.
    if (drawn) drawn.style.minWidth = `${(drawn.viewBox.baseVal.width * MIN_SCALE).toFixed(0)}px`;
    drawn?.setAttribute("role", "img");
    drawn?.setAttribute("aria-label", manifest.alt);
    // The diagram names every stage itself, so the numbered key below it would only repeat them.
    const key = stage.parentElement?.querySelector<HTMLElement>(".visual-layer__labels");
    if (key) key.hidden = true;
    return {
      destroy: () => {
        holder.remove();
        if (key) key.hidden = false;
      },
    };
  },
});

export default processRenderer;
