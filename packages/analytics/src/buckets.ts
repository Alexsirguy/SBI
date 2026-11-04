import type { ConfidenceBand, ElapsedBucket, SizeBucket } from "./browser-events";
import type { z } from "zod";

export function elapsedBucket(ms: number): z.infer<typeof ElapsedBucket> {
  if (ms < 1000) return "<1s";
  if (ms < 3000) return "1-3s";
  if (ms < 10_000) return "3-10s";
  if (ms < 30_000) return "10-30s";
  if (ms < 60_000) return "30-60s";
  return ">60s";
}

export function sizeBucket(bytes: number): z.infer<typeof SizeBucket> {
  const kb = bytes / 1024;
  if (kb < 250) return "<250KB";
  if (kb < 1024) return "250KB-1MB";
  if (kb < 3 * 1024) return "1-3MB";
  if (kb < 10 * 1024) return "3-10MB";
  return ">10MB";
}

/** Matches the recognition certainty bands, so dashboards and the UI agree. */
export function confidenceBand(
  confidence: number | null | undefined,
): z.infer<typeof ConfidenceBand> {
  if (confidence == null) return "none";
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

/** Where a slider sits in its range, in thirds; the exact value says little and could fingerprint. */
export function rangeBucket(value: number, min: number, max: number): "low" | "mid" | "high" {
  const at = max > min ? (value - min) / (max - min) : 0;
  return at < 1 / 3 ? "low" : at < 2 / 3 ? "mid" : "high";
}

/** A coarse class from what the browser reports; unknown counts as mid. */
export function deviceTier(nav: {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  connection?: { effectiveType?: string };
}): "low" | "mid" | "high" {
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const network = nav.connection?.effectiveType;
  if (cores <= 2 || memory <= 2 || network === "2g" || network === "slow-2g") return "low";
  if (cores >= 8 && memory >= 8 && network !== "3g") return "high";
  return "mid";
}
