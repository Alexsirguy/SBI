"use client";

import type { AssetCredit, VisualManifest } from "@sbi/contracts";
import { AssetCredits } from "@sbi/ui";
import type { VisualRegistry } from "@sbi/visuals";
import { useEffect, useId, useRef } from "react";
import { elapsedBucket, rangeBucket } from "@sbi/analytics";
import { track } from "../analytics/track";
import { countForClass } from "../class/class-activity";
import { useT } from "../i18n/provider";
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
  const t = useT("lesson");
  const mountRef = useRef<HTMLDivElement>(null);
  const descriptionId = useId();

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const controller = new AbortController();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const started = performance.now();
    let destroy: (() => void) | undefined;
    void registry
      .mount(manifest, mount, { reducedMotion, signal: controller.signal })
      .then((mounted) => {
        if (controller.signal.aborted) mounted.destroy();
        else {
          destroy = () => mounted.destroy();
          track("visual_loaded", {
            visualId: manifest.visualId,
            kind: manifest.kind,
            elapsed: elapsedBucket(performance.now() - started),
          });
        }
      });
    // "change" fires when a slider is let go, so a drag counts once, not per pixel.
    const figure = mount.closest("figure");
    let counted = false;
    const changed = (event: Event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "range") return;
      const controlId = manifest.controls?.find(
        (control) => input.id === `${manifest.visualId}-${control.id}`,
      )?.id;
      if (!controlId) return;
      // Once per visual per visit, so a class's count means visuals tried, not slider drags.
      if (!counted) countForClass("visual_used");
      counted = true;
      track("interaction_changed", {
        visualId: manifest.visualId,
        controlId,
        rangeBucket: rangeBucket(Number(input.value), Number(input.min), Number(input.max)),
      });
    };
    figure?.addEventListener("change", changed, { signal: controller.signal });
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
        {manifest.assumptions.length > 0
          ? t("visualMadeByAiWith", { assumptions: manifest.assumptions.join(", ") })
          : t("visualMadeByAi")}
      </p>
      <AssetCredits credits={manifest.credits ?? []} />
    </figure>
  );
}
