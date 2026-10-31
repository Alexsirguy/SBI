"use client";

import type { VisualManifest } from "@sbi/contracts";
import type { VisualRegistry } from "@sbi/visuals";
import { useEffect, useId, useRef } from "react";
import { webRegistry } from "./registry";
import "./visuals.css";

/** Draws one manifest through the registry; the description is always there for screen readers. */
export function VisualMount({
  manifest,
  registry = webRegistry,
}: {
  manifest: VisualManifest;
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
      {manifest.assumptions.length > 0 ? (
        <p className="visual__assumptions">Simplified: {manifest.assumptions.join(", ")}.</p>
      ) : null}
    </figure>
  );
}
