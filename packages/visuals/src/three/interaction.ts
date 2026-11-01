import type * as Three from "three";
import type { OrbitControls as Orbit } from "three/addons/controls/OrbitControls.js";

export interface Hotspot {
  /** The label id it belongs to; its number is the label's place in the Parts key. */
  id: string;
  number: number;
  meshes: Three.Mesh[];
}

export interface Interaction {
  /** Moves the numbered markers to follow their parts; call after every render. */
  updateMarkers(): void;
  destroy(): void;
}

const HIGHLIGHT = 0x7a5200;

function button(document: Document, text: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "sbi-button sbi-button--quiet sbi-button--small";
  element.textContent = text;
  element.addEventListener("click", onClick);
  return element;
}

/** Rotate, pull apart and point at parts: the same 3D tools for every kind drawn with three.js. */
export function attachInteraction(options: {
  three: typeof Three;
  OrbitControls: typeof Orbit;
  camera: Three.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  /** Positioned box around the canvas, which holds the markers. */
  wrapper: HTMLElement;
  /** Where view buttons and the pull-apart slider go. */
  toolbar: HTMLElement;
  centre: Three.Vector3;
  size: number;
  render(): void;
  explode(amount: number): void;
  hotspots: Hotspot[];
  /** The common layer's Parts key, whose entries become highlight buttons. */
  partsKey: HTMLElement | null;
}): Interaction {
  const { three, camera, canvas, wrapper, toolbar, centre, size, render } = options;
  const document = canvas.ownerDocument;
  const controls = new options.OrbitControls(camera, canvas);
  controls.target.copy(centre);
  controls.enablePan = false;
  controls.minDistance = size * 0.5;
  controls.maxDistance = size * 8;
  controls.update();
  controls.addEventListener("change", render);
  const home = camera.position.clone();

  // Dragging is not the only way to turn the model: buttons do it from the keyboard too.
  const turn = (degrees: number) => {
    const offset = camera.position.clone().sub(centre);
    offset.applyAxisAngle(camera.up, (degrees * Math.PI) / 180);
    camera.position.copy(centre).add(offset);
    controls.update();
  };
  const view = document.createElement("div");
  view.className = "visual-3d__view";
  view.setAttribute("role", "group");
  view.setAttribute("aria-label", "View");
  view.append(
    button(document, "Turn left", () => turn(-30)),
    button(document, "Turn right", () => turn(30)),
    button(document, "Reset view", () => {
      camera.position.copy(home);
      controls.update();
    }),
  );

  const apart = document.createElement("div");
  apart.className = "visual-layer__control";
  const sliderId = `${canvas.id || "visual"}-apart`;
  const label = document.createElement("label");
  label.htmlFor = sliderId;
  label.textContent = "Pull the parts apart";
  const value = document.createElement("output");
  value.setAttribute("for", sliderId);
  value.textContent = "0%";
  const slider = document.createElement("input");
  Object.assign(slider, {
    type: "range",
    id: sliderId,
    min: "0",
    max: "100",
    step: "10",
    value: "0",
  });
  slider.setAttribute("aria-valuetext", "0%");
  slider.addEventListener("input", () => {
    value.textContent = `${slider.value}%`;
    slider.setAttribute("aria-valuetext", value.textContent);
    options.explode(Number(slider.value) / 100);
    render();
  });
  apart.append(label, value, slider);
  toolbar.append(view, apart);

  const markers = new Map<string, HTMLElement>();
  for (const hotspot of options.hotspots) {
    const marker = document.createElement("span");
    marker.className = "visual-3d__marker";
    marker.textContent = String(hotspot.number);
    // The Parts key carries the words; the number on the picture is only a pointer to it.
    marker.setAttribute("aria-hidden", "true");
    wrapper.append(marker);
    markers.set(hotspot.id, marker);

    const entry = options.partsKey?.querySelector<HTMLElement>(`[data-label="${hotspot.id}"]`);
    if (!entry) continue;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "visual-3d__part";
    toggle.textContent = entry.textContent;
    toggle.setAttribute("aria-pressed", "false");
    toggle.addEventListener("click", () => {
      const on = toggle.getAttribute("aria-pressed") !== "true";
      toggle.setAttribute("aria-pressed", String(on));
      marker.classList.toggle("visual-3d__marker--on", on);
      for (const mesh of hotspot.meshes) {
        (mesh.material as Three.MeshStandardMaterial).emissive.setHex(on ? HIGHLIGHT : 0x000000);
      }
      render();
    });
    entry.replaceChildren(toggle);
  }

  const point = new three.Vector3();
  const bounds = new three.Box3();
  return {
    updateMarkers() {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      for (const hotspot of options.hotspots) {
        const marker = markers.get(hotspot.id);
        if (!marker) continue;
        bounds.makeEmpty();
        for (const mesh of hotspot.meshes) bounds.expandByObject(mesh);
        bounds.getCenter(point).project(camera);
        marker.style.left = `${((point.x + 1) / 2) * width}px`;
        marker.style.top = `${((1 - point.y) / 2) * height}px`;
        marker.hidden = point.z > 1;
      }
    },
    destroy() {
      controls.dispose();
      view.remove();
      apart.remove();
      for (const marker of markers.values()) marker.remove();
    },
  };
}
