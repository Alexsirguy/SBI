"use client";

import type { VisualRef } from "@sbi/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { VisualMount } from "../visuals/visual-mount";

/** Fetches a lesson's visual by reference and draws it, keeping its alt text while it loads. */
export function VisualFrame({ visual }: { visual: VisualRef }) {
  const manifest = useQuery({
    queryKey: ["visual", visual.visualId],
    queryFn: () => api("getVisual", { visualId: visual.visualId }),
    staleTime: Infinity,
  });
  if (manifest.data) return <VisualMount manifest={manifest.data} />;
  return (
    <figure className="visual visual--pending" aria-busy={manifest.isPending}>
      <p>{visual.alt}</p>
      {manifest.isError ? <p className="visual__note">This picture could not load.</p> : null}
    </figure>
  );
}
