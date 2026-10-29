"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

// Null means "not searched yet", so editing the query never fires a request on its own.
export function useTaxonomySearch(query: string | null) {
  return useQuery({
    enabled: query !== null,
    queryFn: () => api("searchTaxonomy", { q: query ?? "" }),
    queryKey: ["taxonomy-search", query],
    staleTime: Infinity,
  });
}
