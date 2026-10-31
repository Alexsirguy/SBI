import { newId, sha256Hex, type VisualAsset, type VisualManifest } from "@sbi/contracts";
import { pubChemStructureAsset } from "@sbi/rights";
import { molfileOnly, MoleculeSpec, sdfProblems } from "./kinds/molecule-spec";

const PUG = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";

export interface PubChemStructure {
  cid: number;
  sdf: string;
}

/** Remembers structures by name, so each molecule is fetched from PubChem once. */
export interface PubChemCache {
  get(name: string): Promise<PubChemStructure | undefined>;
  set(name: string, structure: PubChemStructure): Promise<void>;
}

export function memoryPubChemCache(): PubChemCache {
  const entries = new Map<string, PubChemStructure>();
  return {
    get: async (name) => entries.get(name),
    set: async (name, structure) => void entries.set(name, structure),
  };
}

async function lookUp(name: string, fetcher: typeof fetch): Promise<PubChemStructure | string> {
  const ids = await fetcher(`${PUG}/compound/name/${encodeURIComponent(name)}/cids/JSON`);
  if (ids.status === 404) return `PubChem does not know a molecule called "${name}"`;
  if (!ids.ok) return `PubChem did not answer for "${name}" (${ids.status})`;
  const cid = ((await ids.json()) as { IdentifierList?: { CID?: number[] } }).IdentifierList
    ?.CID?.[0];
  if (!cid) return `PubChem does not know a molecule called "${name}"`;
  const record = await fetcher(`${PUG}/compound/cid/${cid}/SDF?record_type=3d`);
  // Salts, mixtures and very large molecules have no computed 3D conformer.
  if (!record.ok) return `PubChem has no 3D structure for "${name}"`;
  return { cid, sdf: molfileOnly(await record.text()) };
}

/** Fills each molecule's structure from PubChem and returns the rights record for each one. */
export async function resolveMolecules(
  manifest: VisualManifest,
  options: { fetch?: typeof fetch; cache: PubChemCache },
): Promise<{ manifest: VisualManifest; assets: VisualAsset[] } | { problems: string[] }> {
  const parsed = MoleculeSpec.safeParse(manifest.spec);
  if (!parsed.success) {
    return {
      problems: parsed.error.issues.map(
        (issue) => `spec.${issue.path.join(".")}: ${issue.message}`,
      ),
    };
  }
  const fetcher = options.fetch ?? fetch;
  const problems: string[] = [];
  const assets: VisualAsset[] = [];
  const molecules: MoleculeSpec["molecules"] = [];
  for (const molecule of parsed.data.molecules) {
    const key = molecule.name.trim().toLowerCase();
    let structure = await options.cache.get(key);
    if (!structure) {
      const found = await lookUp(key, fetcher).catch(
        () => `PubChem could not be reached for "${key}"`,
      );
      if (typeof found === "string") {
        problems.push(found);
        continue;
      }
      structure = found;
      await options.cache.set(key, structure);
    }
    const shape = sdfProblems(molecule.name, structure.sdf);
    if (shape.length > 0) {
      problems.push(...shape);
      continue;
    }
    molecules.push({ ...molecule, cid: structure.cid, sdf: structure.sdf });
    assets.push(
      pubChemStructureAsset({
        assetId: newId(),
        cid: structure.cid,
        sha256: await sha256Hex(structure.sdf),
        sizeBytes: new TextEncoder().encode(structure.sdf).length,
        accessibilityFallback: manifest.fallback.text,
      }),
    );
  }
  if (problems.length > 0) return { problems };
  return {
    manifest: {
      ...manifest,
      spec: { molecules },
      assetIds: [...manifest.assetIds, ...assets.map((asset) => asset.assetId)],
    },
    assets,
  };
}
