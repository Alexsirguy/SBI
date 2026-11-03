import { EnvError } from "./env-error";

export const FEATURE_DEFAULTS = {
  tutor: false,
  // On by product decision (ADR 0006); `!photoRecognition` stops photos reaching any vendor.
  photoRecognition: true,
};

export type FeatureFlags = Readonly<Record<keyof typeof FEATURE_DEFAULTS, boolean>>;

/** Applies a comma list like `tutor,!photoRecognition` on top of the defaults. */
export function parseFlags<T extends Record<string, boolean>>(
  defaults: T,
  raw: string | undefined,
): Readonly<Record<keyof T, boolean>> {
  const flags: Record<string, boolean> = { ...defaults };

  for (const token of (raw ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)) {
    const enabled = !token.startsWith("!");
    const name = enabled ? token : token.slice(1);
    if (!(name in defaults)) throw new EnvError(`Unknown feature flag "${name}"`);
    flags[name] = enabled;
  }

  return flags as Record<keyof T, boolean>;
}
