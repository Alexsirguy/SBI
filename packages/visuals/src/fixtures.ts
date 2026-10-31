import { VisualManifest } from "@sbi/contracts";
import { RAINBOW_CODE } from "./kinds/rainbow";
import { REFERENCE_MECHANISMS, REFERENCE_VISUALS } from "./references";

const CLAIM = "0192f1a0-0000-7000-8000-0000000000f1";

// PubChem CID 962, molfile block only (see pubChemStructureAsset for its rights record).
const WATER_SDF =
  "962\n  -OEChem-10312612333D\n\n  3  2  0     0  0  0  0  0  0999 V2000\n    0.0000    0.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0\n    0.2774    0.8929    0.2544 H   0  0  0  0  0  0  0  0  0  0  0  0\n    0.6068   -0.2383   -0.7169 H   0  0  0  0  0  0  0  0  0  0  0  0\n  1  2  1  0  0  0  0\n  1  3  1  0  0  0  0\nM  END\n";

// One hand-written manifest per kind, for the hidden /visuals gallery and the visual e2e tests.
export const GALLERY_FIXTURES: readonly VisualManifest[] = [
  {
    ...REFERENCE_MECHANISMS.engine,
    labels: [
      { id: "piston", text: "Piston", claimId: CLAIM },
      { id: "connectingRod", text: "Connecting rod", claimId: CLAIM },
      { id: "crankshaft", text: "Crankshaft", claimId: CLAIM },
    ],
  },
  {
    visualId: "0192f1a0-0000-7000-8000-0000000000a2",
    kind: "molecule",
    alt: "A water molecule: one oxygen atom bonded to two hydrogen atoms",
    fallback: { text: "Water is one oxygen atom joined to two hydrogen atoms, in a bent shape." },
    spec: { molecules: [{ name: "water", caption: "Water", cid: 962, sdf: WATER_SDF }] },
  },
  {
    visualId: "0192f1a0-0000-7000-8000-0000000000a3",
    kind: "process",
    alt: "Photosynthesis: light, water and carbon dioxide become sugar and oxygen",
    fallback: {
      text: "Leaves take in light, water and carbon dioxide, and make sugar and oxygen.",
    },
    labels: [{ id: "chloroplast", text: "Chloroplast", claimId: CLAIM }],
    spec: [
      "flowchart LR",
      "  light[Sunlight] --> leaf[Chloroplast in the leaf]",
      "  water[Water from the roots] --> leaf",
      "  air[Carbon dioxide from the air] --> leaf",
      "  leaf --> sugar[Sugar for growth]",
      "  leaf --> oxygen[Oxygen into the air]",
    ].join("\n"),
  },
  REFERENCE_VISUALS.heating,
  {
    visualId: "0192f1a0-0000-7000-8000-0000000000a5",
    kind: "playground",
    alt: "Light bending through a raindrop and splitting into colours",
    fallback: {
      text: "Each colour of light bends by a slightly different amount, so they spread out.",
    },
    assumptions: ["One raindrop, drawn much larger", "Angles from 40° to 42°"],
    labels: [
      { id: "raindrop", text: "Raindrop", claimId: CLAIM },
      { id: "reflection", text: "Reflection at the back", claimId: CLAIM },
    ],
    controls: [
      {
        id: "spread",
        label: "Spread of the colours",
        unit: "×",
        min: 1,
        max: 6,
        step: 1,
        value: 1,
      },
    ],
    spec: { code: RAINBOW_CODE },
  },
].map((manifest) => VisualManifest.parse(manifest));
