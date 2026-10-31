import { VisualManifest } from "@sbi/contracts";
import { REFERENCE_MECHANISMS } from "./references";

const CLAIM = "0192f1a0-0000-7000-8000-0000000000f1";

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
  {
    visualId: "0192f1a0-0000-7000-8000-0000000000a4",
    kind: "graph",
    alt: "Water temperature over time in a kettle, flattening at 100 °C",
    fallback: { text: "The water warms steadily, then stays at 100 °C while it boils." },
    assumptions: ["Sea level", "No heat lost", "Starts at 20 °C"],
    controls: [
      {
        id: "power",
        label: "Heater power",
        unit: "W",
        min: 500,
        max: 3000,
        step: 100,
        value: 2000,
      },
      { id: "mass", label: "Water", unit: "kg", min: 0.2, max: 1.7, step: 0.1, value: 1 },
    ],
    readouts: [
      {
        id: "timeToBoil",
        label: "Time to reach 100 °C",
        unit: "s",
        formula: "mass * 4190 * 80 / power",
      },
    ],
    spec: {
      x: { name: "t", label: "Time", unit: "s", from: 0, to: 600, samples: 61 },
      series: [
        {
          name: "temperature",
          label: "Temperature",
          unit: "°C",
          formula: "min(20 + power * t / (mass * 4190), 100)",
        },
      ],
    },
  },
  {
    visualId: "0192f1a0-0000-7000-8000-0000000000a5",
    kind: "playground",
    alt: "Light bending through a raindrop and splitting into colours",
    fallback: {
      text: "Each colour of light bends by a slightly different amount, so they spread out.",
    },
  },
].map((manifest) => VisualManifest.parse(manifest));
