import { VisualManifest } from "@sbi/contracts";

// One hand-written manifest per kind, for the hidden /visuals gallery and the visual e2e tests.
export const GALLERY_FIXTURES: readonly VisualManifest[] = [
  {
    visualId: "0192f1a0-0000-7000-8000-0000000000a1",
    kind: "mechanism",
    alt: "A piston engine: the crankshaft turns as the piston moves up and down",
    fallback: {
      text: "Burning fuel pushes the piston down; the connecting rod turns the crankshaft, which turns the wheels.",
    },
    assumptions: ["One cylinder", "No friction"],
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
  },
  {
    visualId: "0192f1a0-0000-7000-8000-0000000000a4",
    kind: "graph",
    alt: "Water temperature over time in a kettle, flattening at 100 °C",
    fallback: { text: "The water warms steadily, then stays at 100 °C while it boils." },
    assumptions: ["Sea level", "No heat lost"],
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
