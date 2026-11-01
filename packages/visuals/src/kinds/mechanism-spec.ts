import { z } from "zod";

export const MechanismSpec = z.object({
  /** A MuJoCo model built only from primitive shapes, so it needs no files. */
  mjcf: z.string().min(1).max(20_000),
  /** Which slider drives which actuator; a slider with no binding changes only the readouts. */
  bindings: z
    .array(z.object({ control: z.string(), actuator: z.string() }))
    .max(8)
    .default([]),
});
export type MechanismSpec = z.infer<typeof MechanismSpec>;

// Files, plugins and meshes would reach outside the spec; small limits keep phones fast.
const FORBIDDEN = [
  [/<\s*include\b/i, "remove <include>: the model must be one document"],
  [/\bfile\s*=/i, "remove file= attributes: the model may use no files"],
  [/<\s*(plugin|extension|instance)\b/i, "remove plugins"],
  [
    /<\s*(mesh|hfield|skin|flex|flexcomp)\b/i,
    "use primitive geoms (box, sphere, capsule, cylinder, ellipsoid, plane)",
  ],
  [/type\s*=\s*["'](mesh|hfield|sdf)["']/i, "use primitive geom types only"],
] as const;

export const MECHANISM_LIMITS = { bodies: 30, geoms: 60, actuators: 8 };

/** Problems visible in the MJCF text itself, before MuJoCo reads it. */
export function mjcfTextProblems(mjcf: string): string[] {
  const problems: string[] = [];
  if (!/^\s*<mujoco\b/.test(mjcf)) problems.push("the model must start with <mujoco>");
  for (const [pattern, message] of FORBIDDEN) if (pattern.test(mjcf)) problems.push(message);
  return problems;
}
