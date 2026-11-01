import type { VisualManifest } from "@sbi/contracts";
import { z } from "zod";

export const MoleculeSpec = z.object({
  molecules: z
    .array(
      z.object({
        /** What the AI asks PubChem for, such as "water" or "caffeine". */
        name: z.string().min(1).max(60),
        caption: z.string().min(1).max(60).optional(),
        /** Filled in by the server from PubChem; the AI never writes coordinates. */
        cid: z.int().positive().optional(),
        sdf: z.string().max(200_000).optional(),
      }),
    )
    .min(1)
    .max(3),
});
export type MoleculeSpec = z.infer<typeof MoleculeSpec>;

const MAX_ATOMS = 500;

/** Only the molfile block of an SDF record, so PubChem's free-text property fields never travel. */
export function molfileOnly(sdf: string): string {
  const end = sdf.indexOf("M  END");
  return end < 0 ? sdf : `${sdf.slice(0, end + "M  END".length)}\n`;
}

/** The largest distance across the molecule in ångströms, read from its atom coordinates. */
export function moleculeExtent(sdf: string): number {
  const lines = sdf.split(/\r?\n/);
  const atoms = Number.parseInt((lines[3] ?? "").slice(0, 3), 10) || 0;
  const points = lines
    .slice(4, 4 + atoms)
    .map((line) => line.trim().split(/\s+/).slice(0, 3).map(Number));
  let extent = 0;
  for (const a of points) {
    for (const b of points) {
      extent = Math.max(
        extent,
        Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0)),
      );
    }
  }
  return extent;
}

/** Problems with an SDF structure: it must parse, hold some atoms, and be truly 3D. */
export function sdfProblems(name: string, sdf: string): string[] {
  const lines = sdf.split(/\r?\n/);
  const counts = lines[3] ?? "";
  const atoms = Number.parseInt(counts.slice(0, 3), 10);
  if (!Number.isFinite(atoms) || atoms < 1) return [`the structure for ${name} has no atoms`];
  if (atoms > MAX_ATOMS)
    return [`${name} has more than ${MAX_ATOMS} atoms; choose a smaller molecule`];
  const coordinates = lines
    .slice(4, 4 + atoms)
    .map((line) => line.trim().split(/\s+/).slice(0, 3).map(Number));
  if (coordinates.some((xyz) => xyz.length < 3 || xyz.some((value) => !Number.isFinite(value)))) {
    return [`the structure for ${name} has unreadable coordinates`];
  }
  if (atoms > 2 && coordinates.every((xyz) => xyz[2] === 0))
    return [`the structure for ${name} is flat, not 3D`];
  return [];
}

export function readMoleculeSpec(manifest: VisualManifest): MoleculeSpec | { problems: string[] } {
  const parsed = MoleculeSpec.safeParse(manifest.spec);
  if (!parsed.success) {
    return {
      problems: parsed.error.issues.map(
        (issue) => `spec.${issue.path.join(".")}: ${issue.message}`,
      ),
    };
  }
  const problems = parsed.data.molecules.flatMap((molecule) =>
    molecule.sdf
      ? sdfProblems(molecule.name, molecule.sdf)
      : [`${molecule.name} has not been looked up in PubChem`],
  );
  return problems.length > 0 ? { problems } : parsed.data;
}
