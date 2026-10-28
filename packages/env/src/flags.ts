import { EnvError } from "./env-error";

export const FEATURE_DEFAULTS = {
  visualLab: false,
  tutor: false,
  // Off until Meta confirms Standard-mode retention in writing (ADR 0006).
  photoRecognition: false,
};

export type FeatureFlags = Readonly<Record<keyof typeof FEATURE_DEFAULTS, boolean>>;

/** Applies a comma list like `tutor,!visualLab` on top of the defaults. */
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
