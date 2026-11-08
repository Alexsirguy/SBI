import type { ApiRequest } from "@sbi/contracts";
import { classCode } from "./class-context";

/** Adds one to the class's weekly count, only from a class link; who it was is never sent. */
export function countForClass(metric: ApiRequest<"recordClassActivity">["metric"]): void {
  const code = classCode();
  if (!code) return;
  // Loaded only inside a class, and failures are dropped so a count never gets in the way.
  void import("../api")
    .then(({ api }) => api("recordClassActivity", { code, metric }))
    .catch(() => undefined);
}
