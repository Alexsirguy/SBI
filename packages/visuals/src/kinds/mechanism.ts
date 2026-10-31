import type { MjModel } from "@mujoco/mujoco";
import type * as Three from "three";
import { kindRenderer } from "../kind";
import { attachInteraction } from "../three/interaction";
import { applyControls, loadMechanism } from "./mechanism-sim";

// MuJoCo's geom type numbers (mjtGeom); meshes and height fields are refused by the validator.
const PLANE = 0;
const SPHERE = 2;
const CAPSULE = 3;
const ELLIPSOID = 4;
const CYLINDER = 5;
const BOX = 6;

function geometryFor(
  three: typeof Three,
  model: MjModel,
  index: number,
): Three.BufferGeometry | null {
  const [a = 0.1, b = 0.1, c = 0.1] = model.geom_size.slice(index * 3, index * 3 + 3);
  switch (model.geom_type[index]) {
    case PLANE:
      return new three.PlaneGeometry(2 * (a || 5), 2 * (b || 5));
    case SPHERE:
      return new three.SphereGeometry(a, 24, 16);
    // three.js builds these along y; MuJoCo's run along z.
    case CAPSULE:
      return new three.CapsuleGeometry(a, 2 * b, 8, 16).rotateX(Math.PI / 2);
    case CYLINDER:
      return new three.CylinderGeometry(a, a, 2 * b, 24).rotateX(Math.PI / 2);
    case ELLIPSOID:
      return new three.SphereGeometry(1, 24, 16).scale(a, b, c);
    case BOX:
      return new three.BoxGeometry(2 * a, 2 * b, 2 * c);
    default:
      return null;
  }
}

/** A MuJoCo model drawn with three.js; the 2.7 MB engine loads only when the learner asks. */
export const mechanismRenderer = kindRenderer({
  kind: "mechanism",
  loadOnTap: "See it in action",
  async draw(manifest, stage, values, options) {
    const [{ default: loadMujoco }, three, { OrbitControls }] = await Promise.all([
      import("@mujoco/mujoco"),
      import("three"),
      import("three/addons/controls/OrbitControls.js"),
    ]);
    const mujoco = await loadMujoco();
    const loaded = loadMechanism(mujoco, manifest);
    if ("problems" in loaded) throw new Error(loaded.problems.join("; "));
    const { model, data } = loaded;
    applyControls(loaded, values);
    mujoco.mj_forward(model, data);

    const document = stage.ownerDocument;
    const canvas = document.createElement("canvas");
    canvas.className = "visual-mechanism";
    canvas.id = `mechanism-${manifest.visualId}`;
    const wrapper = document.createElement("div");
    wrapper.className = "visual-3d";
    wrapper.append(canvas);
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", manifest.alt);
    // Transparent, so the page's own surface colour shows behind the model in both themes.
    const renderer = new three.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene = new three.Scene();
    scene.add(new three.HemisphereLight(0xffffff, 0x8899aa, 2.2));
    const sun = new three.DirectionalLight(0xffffff, 1.6);
    sun.position.set(2, -3, 4);
    scene.add(sun);

    const meshes: (Three.Mesh | null)[] = [];
    const box = new three.Box3();
    for (let index = 0; index < model.ngeom; index += 1) {
      const geometry = geometryFor(three, model, index);
      if (!geometry) {
        meshes.push(null);
        continue;
      }
      const [r = 0.6, g = 0.6, b = 0.6, alpha = 1] = model.geom_rgba.slice(
        index * 4,
        index * 4 + 4,
      );
      const material = new three.MeshStandardMaterial({
        color: new three.Color(r, g, b),
        transparent: alpha < 1,
        opacity: alpha,
        roughness: 0.6,
      });
      const mesh = new three.Mesh(geometry, material);
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
      meshes.push(mesh);
    }

    // Pulling apart moves each part away from the middle, so hidden parts come into view.
    let apart = 0;
    const middle = new three.Vector3();
    function place() {
      for (let index = 0; index < meshes.length; index += 1) {
        const mesh = meshes[index];
        if (!mesh) continue;
        const p = Array.from(data.geom_xpos.slice(index * 3, index * 3 + 3) as ArrayLike<number>);
        if (apart > 0 && model.geom_type[index] !== PLANE) {
          for (let axis = 0; axis < 3; axis += 1) {
            p[axis] = (p[axis] ?? 0) + ((p[axis] ?? 0) - middle.getComponent(axis)) * apart;
          }
        }
        const m = data.geom_xmat.slice(index * 9, index * 9 + 9);
        mesh.matrix.set(
          m[0] ?? 1,
          m[1] ?? 0,
          m[2] ?? 0,
          p[0] ?? 0,
          m[3] ?? 0,
          m[4] ?? 1,
          m[5] ?? 0,
          p[1] ?? 0,
          m[6] ?? 0,
          m[7] ?? 0,
          m[8] ?? 1,
          p[2] ?? 0,
          0,
          0,
          0,
          1,
        );
        mesh.matrixWorldNeedsUpdate = true;
      }
    }
    place();

    // Frame everything but floors, which are infinite in MuJoCo and would push the camera away.
    meshes.forEach((mesh, index) => {
      if (mesh && model.geom_type[index] !== PLANE) box.expandByObject(mesh);
    });
    const centre = box.isEmpty() ? new three.Vector3() : box.getCenter(new three.Vector3());
    middle.copy(centre);
    const size = box.isEmpty() ? 1 : Math.max(...box.getSize(new three.Vector3()).toArray(), 0.1);
    const camera = new three.PerspectiveCamera(40, 1, size / 100, size * 100);
    camera.up.set(0, 0, 1);
    // Far enough for the whole model to fit the field of view, with a little room around it.
    const distance = (size / (2 * Math.tan((camera.fov * Math.PI) / 360))) * 1.5;
    camera.position
      .copy(centre)
      .add(new three.Vector3(0.6, -1, 0.45).normalize().multiplyScalar(distance));
    camera.lookAt(centre);

    function resize() {
      const width = stage.clientWidth || 320;
      const height = Math.round(Math.min(360, Math.max(220, width * 0.6)));
      renderer.setSize(width, height, false);
      canvas.style.width = "100%";
      canvas.style.height = `${height}px`;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    const playing = { value: !options.reducedMotion };
    const play = document.createElement("button");
    play.type = "button";
    play.className = "sbi-button sbi-button--quiet sbi-button--small";
    const stepButton = document.createElement("button");
    stepButton.type = "button";
    stepButton.className = "sbi-button sbi-button--quiet sbi-button--small";
    stepButton.textContent = "Step forward";
    function showState() {
      play.textContent = playing.value ? "Pause" : "Play";
      play.setAttribute("aria-pressed", String(playing.value));
      stepButton.style.display = playing.value ? "none" : "";
    }
    play.addEventListener("click", () => {
      playing.value = !playing.value;
      showState();
    });
    stepButton.addEventListener("click", () => advance(0.1));
    showState();
    const buttons = document.createElement("div");
    buttons.className = "visual-mechanism__buttons";
    buttons.append(play, stepButton);
    const toolbar = document.createElement("div");
    toolbar.className = "visual-3d__toolbar";
    stage.append(wrapper, buttons, toolbar);

    const named = (index: number) => [
      model.geom(index)?.name,
      model.body(model.geom_bodyid[index] as number)?.name,
    ];
    const hotspots = manifest.labels.flatMap((label, number) => {
      const parts = meshes.filter(
        (mesh, index): mesh is Three.Mesh => mesh !== null && named(index).includes(label.id),
      );
      return parts.length > 0 ? [{ id: label.id, number: number + 1, meshes: parts }] : [];
    });
    const interaction = attachInteraction({
      three,
      OrbitControls,
      camera,
      canvas,
      wrapper,
      toolbar,
      centre,
      size,
      render: draw,
      explode(amount) {
        apart = amount;
        place();
      },
      hotspots,
      partsKey: stage.parentElement?.querySelector('[aria-label="Parts"]') ?? null,
    });
    function draw() {
      renderer.render(scene, camera);
      interaction.updateMarkers();
    }

    function advance(seconds: number) {
      const steps = Math.min(Math.round(seconds / model.opt.timestep), 500);
      for (let step = 0; step < steps; step += 1) mujoco.mj_step(model, data);
      place();
      draw();
    }

    const observer = new ResizeObserver(() => {
      resize();
      draw();
    });
    observer.observe(stage);
    resize();
    draw();

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // Real time, capped so a hidden tab does not try to catch up all at once.
      const elapsed = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (playing.value) advance(elapsed);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return {
      update(next) {
        applyControls(loaded, next);
        if (!playing.value) advance(0);
      },
      destroy() {
        cancelAnimationFrame(frame);
        observer.disconnect();
        interaction.destroy();
        scene.traverse((object) => {
          if (object instanceof three.Mesh) {
            object.geometry.dispose();
            (object.material as Three.Material).dispose();
          }
        });
        renderer.dispose();
        loaded.dispose();
        wrapper.remove();
        buttons.remove();
        toolbar.remove();
      },
    };
  },
});

export default mechanismRenderer;
