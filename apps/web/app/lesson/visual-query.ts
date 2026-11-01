import { queryOptions } from "@tanstack/react-query";
import { api } from "../api";

/** One cache entry per visual, shared by the frame that draws it and the lesson's experiment. */
export const visualQuery = (visualId: string) =>
  queryOptions({
    queryKey: ["visual", visualId],
    queryFn: () => api("getVisual", { visualId }),
    staleTime: Infinity,
  });
