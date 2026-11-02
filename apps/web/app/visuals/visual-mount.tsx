"use client";

import type { AssetCredit, VisualManifest } from "@sbi/contracts";
import { AssetCredits } from "@sbi/ui";
import type { VisualRegistry } from "@sbi/visuals";
import { useEffect, useId, useRef } from "react";
import { webRegistry } from "./registry";
import "./visuals.css";

/** Draws one manifest through the registry; the description is always there for screen readers. */
export function VisualMount({
  manifest,
  registry = webRegistry,
}: {
  /** Served visuals carry the credits their third-party assets require (#73). */
  manifest: VisualManifest & { credits?: AssetCredit[] };
  registry?: VisualRegistry;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const descriptionId = useId();

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const controller = new AbortController();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let destroy: (() => void) | undefined;
    void registry
      .mount(manifest, mount, { reducedMotion, signal: controller.signal })
      .then((mounted) => {
        if (controller.signal.aborted) mounted.destroy();
        else destroy = () => mounted.destroy();
      });
    return () => {
      controller.abort();
      destroy?.();
    };
  }, [manifest, registry]);

  return (
    <figure className="visual" aria-label={manifest.alt} aria-describedby={descriptionId}>
      <div ref={mountRef} className="visual__stage" data-kind={manifest.kind} />
      <p id={descriptionId} className="sbi-visually-hidden">
        {manifest.longDescription ?? manifest.alt}
      </p>
      {/* Every visual is generated for its lesson (ADR 0014), so it says so, with its simplifications. */}
      <p className="visual__assumptions">
        Made by AI for this lesson and simplified
        {manifest.assumptions.length > 0 ? `: ${manifest.assumptions.join(", ")}.` : "."}
      </p>
      <AssetCredits credits={manifest.credits ?? []} />
    </figure>
  );
}
