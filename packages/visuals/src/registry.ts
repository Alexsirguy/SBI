import { VisualKind, type VisualManifest } from "@sbi/contracts";
import { fallbackRenderer } from "./fallback";
import type { MountedVisual, RenderOptions, VisualRenderer } from "./renderer";

export type RendererLoaders = Partial<Record<VisualKind, () => Promise<VisualRenderer>>>;

export interface MountResult extends MountedVisual {
  renderer: VisualRenderer;
  /** Why the fallback was shown instead of the manifest's own kind, when it was. */
  fellBack?: string;
}

export interface VisualRegistry {
  resolve(kind: string): Promise<VisualRenderer>;
  mount(manifest: VisualManifest, mount: HTMLElement, options: RenderOptions): Promise<MountResult>;
}

const ALLOWED = new Set<string>(VisualKind.options);

function isAllowed(kind: string): kind is VisualKind {
  return ALLOWED.has(kind);
}

/** Picks a renderer by kind, loading its code only when a visual of that kind is shown. */
export function createRegistry(loaders: RendererLoaders): VisualRegistry {
  const cache = new Map<VisualKind, Promise<VisualRenderer>>();

  async function resolve(kind: string): Promise<VisualRenderer> {
    if (!isAllowed(kind)) return fallbackRenderer;
    const load = loaders[kind];
    if (!load) return fallbackRenderer;
    let pending = cache.get(kind);
    if (!pending) {
      pending = load();
      // A failed chunk download must not poison later visuals of the same kind.
      pending.catch(() => cache.delete(kind));
      cache.set(kind, pending);
    }
    return pending;
  }

  return {
    resolve,
    async mount(manifest, mount, options) {
      let renderer: VisualRenderer;
      try {
        renderer = await resolve(manifest.kind);
      } catch (error) {
        return showFallback(manifest, mount, options, `renderer did not load: ${String(error)}`);
      }
      if (renderer === fallbackRenderer) {
        return showFallback(manifest, mount, options, `no renderer for ${manifest.kind}`);
      }
      try {
        const mounted = await renderer.load(manifest, mount, options);
        return { ...mounted, renderer };
      } catch (error) {
        return showFallback(manifest, mount, options, `visual did not draw: ${String(error)}`);
      }
    },
  };
}

async function showFallback(
  manifest: VisualManifest,
  mount: HTMLElement,
  options: RenderOptions,
  reason: string,
): Promise<MountResult> {
  const mounted = await fallbackRenderer.load(manifest, mount, options);
  return { ...mounted, renderer: fallbackRenderer, fellBack: reason };
}
