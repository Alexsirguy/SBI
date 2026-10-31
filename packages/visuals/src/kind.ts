import type { VisualKind, VisualManifest } from "@sbi/contracts";
import { mountCommonLayer, type ControlValues } from "./common/layer";
import type { RenderOptions, VisualRenderer } from "./renderer";

export interface Drawing {
  update?(values: ControlValues): void;
  destroy?(): void;
}

/** Wraps a kind's drawing in the common layer, and for heavy kinds waits for the learner to ask. */
export function kindRenderer(definition: {
  kind: VisualKind;
  /** Libraries this large load only on tap (ADR 0014): the button names what it shows. */
  loadOnTap?: string;
  draw(
    manifest: VisualManifest,
    stage: HTMLElement,
    values: ControlValues,
    options: RenderOptions,
  ): Promise<Drawing>;
}): VisualRenderer {
  return {
    kind: definition.kind,
    fallback: (manifest) => manifest.fallback,
    describe: (manifest) => manifest.longDescription ?? manifest.alt,
    async load(manifest, mount, options) {
      let drawing: Drawing | undefined;
      const layer = mountCommonLayer(manifest, mount, (values) => drawing?.update?.(values));
      const start = async () => {
        drawing = await definition.draw(manifest, layer.stage, layer.values, options);
        if (options.signal?.aborted) drawing.destroy?.();
      };
      if (definition.loadOnTap) {
        const document = mount.ownerDocument;
        const text = document.createElement("p");
        text.className = "visual-layer__waiting";
        text.textContent = manifest.fallback.text;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "sbi-button sbi-button--primary visual-layer__show";
        button.textContent = definition.loadOnTap;
        button.addEventListener("click", () => {
          button.disabled = true;
          button.textContent = "Loading…";
          start().then(
            () => {
              text.remove();
              button.remove();
            },
            () => {
              // The fallback text stays, so the learner still has the explanation.
              button.replaceWith(note(document, "This picture could not load."));
            },
          );
        });
        layer.stage.append(text, button);
      } else {
        await start();
      }
      return {
        destroy() {
          drawing?.destroy?.();
          layer.destroy();
        },
      };
    },
  };
}

function note(document: Document, message: string): HTMLElement {
  const element = document.createElement("p");
  element.className = "visual-layer__note";
  element.textContent = message;
  return element;
}
