# 0015. Molecular viewer: 3Dmol.js

- Status: accepted
- Date: 2026-10-31
- Issue: #91
- Builds on: [0014](0014-visuals-generated-for-any-object.md)

## Context

ADR 0014's `molecule` kind shows the molecules a lesson is about, such as water, salt, caffeine or plastics, in 3D. The AI names the molecules. The server looks each one up in PubChem and keeps its computed 3D structure. A viewer in the browser draws it.

We compared the three maintained open-source viewers on licence, maintenance and download size. Sizes are gzipped and were measured from the published packages on 2026-10-31.

| Viewer   | Version | Licence      | Last release | Download (gzipped)           | Fit                                                  |
| -------- | ------- | ------------ | ------------ | ---------------------------- | ---------------------------------------------------- |
| 3Dmol.js | 2.5.5   | BSD-3-Clause | 2026-05      | 156 KB (`3Dmol-min.js`)      | Small molecules and proteins; simple API; reads SDF  |
| NGL      | 2.5.0   | MIT          | 2026-09      | 357 KB (`ngl.js`)            | Built for proteins; heavier for a lesson's few atoms |
| Mol\*    | 5.13.1  | MIT          | 2026-10      | 1.5 MB (`viewer/molstar.js`) | PDB's full viewer; far beyond a lesson's needs       |

All three are actively maintained and permissively licensed. ADR 0005 puts the first 3D view at about 3.4 s on an emulated low-end phone for 343 KB, so every extra 100 KB matters.

## Decision

- **Draw molecules with 3Dmol.js 2.5.5**, loaded with the visual. At 156 KB it doesn't need the tap-to-load step that MuJoCo and Mermaid use.
  - Balls and sticks, one viewer per molecule so they never overlap.
  - Small molecules are zoomed to fill the frame.
  - The view turns slowly, unless the learner prefers reduced motion.
  - **Turn** and **Reset view** buttons.
- **Structures come only from PubChem**, through the API at generation time:
  - The AI writes names, never coordinates.
  - Lookups are cached per name.
  - Only the molfile block is kept, so PubChem's free-text fields never reach the page.
  - Each structure gets its own rights record (`pubChemStructureAsset`), with its CID, its checksum and NCBI's data policy.
- **Validation:** a structure must parse, have between 1 and 500 atoms, and be truly 3D. A name PubChem doesn't know, or one without a 3D conformer (salts, mixtures, polymers), is reported back to the AI for repair.

## Consequences

- Every molecule shown is PubChem's computed structure, credited on the page.
- Large biomolecules over 500 atoms, and polymers, fall back to another kind or to text. Mol\* can be reconsidered if lessons need proteins.
- 3Dmol.js still needs WebGL. Without it, the text fallback shows (#89).
