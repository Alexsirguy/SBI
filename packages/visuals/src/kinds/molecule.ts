import { kindRenderer } from "../kind";
import { moleculeExtent, readMoleculeSpec } from "./molecule-spec";

function button(document: Document, text: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "sbi-button sbi-button--quiet sbi-button--small";
  element.textContent = text;
  return element;
}

/** PubChem's 3D structures drawn as balls and sticks with 3Dmol.js (156 KB, so no tap needed). */
export const moleculeRenderer = kindRenderer({
  kind: "molecule",
  async draw(manifest, stage, _values, options) {
    const spec = readMoleculeSpec(manifest);
    if ("problems" in spec) throw new Error(spec.problems.join("; "));
    const $3Dmol = await import("3dmol");
    const document = stage.ownerDocument;
    const row = document.createElement("div");
    row.className = "visual-molecules";
    const viewers = spec.molecules.map((molecule) => {
      const figure = document.createElement("figure");
      figure.className = "visual-molecule";
      const holder = document.createElement("div");
      holder.className = "visual-molecule__view";
      holder.setAttribute("role", "img");
      holder.setAttribute("aria-label", `3D model of ${molecule.caption ?? molecule.name}`);
      const caption = document.createElement("figcaption");
      caption.textContent = molecule.caption ?? molecule.name;
      figure.append(holder, caption);
      row.append(figure);
      return { holder, molecule };
    });
    const credit = document.createElement("p");
    credit.className = "visual-layer__note";
    credit.textContent = `Structures: PubChem (CID ${spec.molecules.map((m) => m.cid).join(", ")}), National Library of Medicine.`;
    const spinning = { value: !options.reducedMotion };
    const spin = button(document, "");
    const reset = button(document, "Reset view");
    const tools = document.createElement("div");
    tools.className = "visual-mechanism__buttons";
    tools.append(spin, reset);
    stage.append(row, tools, credit);

    // Each molecule gets its own viewer, so they never overlap whatever their sizes.
    const glViewers = viewers.map(({ holder, molecule }) => {
      const viewer = $3Dmol.createViewer(holder, { backgroundAlpha: 0, antialias: true });
      viewer.addModel(molecule.sdf ?? "", "sdf");
      viewer.setStyle({}, { stick: { radius: 0.15 }, sphere: { scale: 0.3 } });
      const frame = () => {
        viewer.zoomTo();
        // 3Dmol never frames less than 5 Å across, which leaves small molecules like water tiny.
        const extent = moleculeExtent(molecule.sdf ?? "");
        if (extent > 0 && extent < 5) viewer.zoom(Math.min(5 / extent, 4) * 0.7);
        viewer.render();
      };
      frame();
      return { viewer, frame };
    });
    function showSpin() {
      spin.textContent = spinning.value ? "Stop turning" : "Turn";
      spin.setAttribute("aria-pressed", String(spinning.value));
      for (const { viewer } of glViewers) viewer.spin(spinning.value ? "y" : false);
    }
    spin.addEventListener("click", () => {
      spinning.value = !spinning.value;
      showSpin();
    });
    reset.addEventListener("click", () => {
      for (const { frame } of glViewers) frame();
    });
    showSpin();
    return {
      destroy() {
        for (const { viewer } of glViewers) {
          viewer.spin(false);
          viewer.clear();
        }
        row.remove();
        tools.remove();
        credit.remove();
      },
    };
  },
});

export default moleculeRenderer;
