import type { VisualManifest } from "@sbi/contracts";
import type { MountedVisual, VisualRenderer } from "./renderer";

/** Draws the manifest's text fallback and still image: the view when nothing richer can load. */
export const fallbackRenderer: VisualRenderer = {
  kind: "fallback",
  async load(manifest, mount) {
    const document = mount.ownerDocument;
    const figure = document.createElement("figure");
    figure.className = "visual-fallback";
    const { text, stillImageUrl } = manifest.fallback;
    if (stillImageUrl) {
      const image = document.createElement("img");
      image.src = stillImageUrl;
      image.alt = manifest.alt;
      figure.append(image);
    }
    const caption = document.createElement("figcaption");
    caption.textContent = text;
    figure.append(caption);
    mount.replaceChildren(figure);
    return { destroy: () => figure.remove() } satisfies MountedVisual;
  },
  fallback: (manifest) => manifest.fallback,
  describe: (manifest: VisualManifest) => manifest.longDescription ?? manifest.alt,
};
