import type { VisualFallback, VisualKind, VisualManifest } from "@sbi/contracts";

export interface RenderOptions {
  /** The learner's `prefers-reduced-motion`; every kind starts still when it is set. */
  reducedMotion: boolean;
  /** Aborted when the frame unmounts, so a slow load never draws into a removed element. */
  signal?: AbortSignal;
}

export interface MountedVisual {
  destroy(): void;
}

/** What every visual kind implements, so the lesson can show any of them the same way. */
export interface VisualRenderer {
  kind: VisualKind | "fallback";
  load(
    manifest: VisualManifest,
    mount: HTMLElement,
    options: RenderOptions,
  ): Promise<MountedVisual>;
  fallback(manifest: VisualManifest): VisualFallback;
  describe(manifest: VisualManifest): string;
}

export interface VisualManifestRepository {
  save(manifest: VisualManifest): Promise<void>;
  get(visualId: string): Promise<VisualManifest | undefined>;
}
