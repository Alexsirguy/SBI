"use client";

import type { VisualRef } from "@sbi/contracts";
import { useQuery } from "@tanstack/react-query";
import { VisualMount } from "../visuals/visual-mount";
import { useT } from "../i18n/provider";
import { visualQuery } from "./visual-query";

/** Fetches a lesson's visual by reference and draws it, keeping its alt text while it loads. */
export function VisualFrame({ visual }: { visual: VisualRef }) {
  const t = useT("lesson");
  const manifest = useQuery(visualQuery(visual.visualId));
  if (manifest.data) return <VisualMount manifest={manifest.data} />;
  return (
    <figure className="visual visual--pending" aria-busy={manifest.isPending}>
      <p>{visual.alt}</p>
      {manifest.isError ? <p className="visual__note">{t("visualCouldNotLoad")}</p> : null}
    </figure>
  );
}
