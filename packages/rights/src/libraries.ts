import type { VisualAsset } from "@sbi/contracts";

interface Library {
  assetId: string;
  name: string;
  version: string;
  kind: VisualAsset["kind"];
  creator: string;
  license: string;
  sha256: string;
  sizeBytes: number;
}

// Checksums are of the published npm tarball, so an upgrade needs a new record and a new review.
const LIBRARIES: readonly Library[] = [
  {
    assetId: "ae36826a-9c08-4dd5-9e6e-5d5ffa8a9a1d",
    name: "three",
    version: "0.187.0",
    kind: "renderer",
    creator: "three.js authors",
    license: "MIT",
    sha256: "ff540832ded0cfe919764d24a3d88f3e2a05f23303f876423e4f893841e90728",
    sizeBytes: 4_795_351,
  },
  {
    assetId: "32a61629-c2a8-42f0-a01b-3e37c592956b",
    name: "@mujoco/mujoco",
    version: "3.17.0",
    kind: "simulation",
    creator: "Google DeepMind",
    license: "Apache-2.0",
    sha256: "c240f833453c506dc31bf743771b4a484d475e30b989d2fd7be00ad953fdaa79",
    sizeBytes: 5_829_353,
  },
  {
    assetId: "fc15a3f7-dd50-40b6-abe9-885cd69ef9e6",
    name: "3dmol",
    version: "2.5.5",
    kind: "renderer",
    creator: "3Dmol.js authors (University of Pittsburgh)",
    license: "BSD-3-Clause",
    sha256: "26d91c5036d4efe78fc032c22cb692fea92bbb3cb1e65d20bf3869673fb3d8f5",
    sizeBytes: 4_231_158,
  },
  {
    assetId: "0f147161-86c6-4cce-89e7-0f98b6767979",
    name: "mermaid",
    version: "12.2.0",
    kind: "renderer",
    creator: "Knut Sveidqvist and mermaid contributors",
    license: "MIT",
    sha256: "071914164d0f6d53e5c26a10a220230d4ae8d37ed0f2263fbf072266f0af3a0a",
    sizeBytes: 25_955_888,
  },
  {
    assetId: "689b8224-5b7d-4872-b424-3c6d906d30c5",
    name: "vega",
    version: "6.4.0",
    kind: "renderer",
    creator: "University of Washington Interactive Data Lab",
    license: "BSD-3-Clause",
    sha256: "3521fb6ff68a94a40323954f0ba4484ba4014b157bfd37f89a3b063082320c42",
    sizeBytes: 894_992,
  },
  {
    assetId: "8cf872a6-ffe0-4cc9-93e2-de5d5f8a9d0a",
    name: "vega-lite",
    version: "6.5.0",
    kind: "renderer",
    creator: "University of Washington Interactive Data Lab",
    license: "BSD-3-Clause",
    sha256: "811230a6bfd2cdbfc359d0c38f624a90df86657b7f251b67be88bcc4eee32b7f",
    sizeBytes: 1_104_896,
  },
  {
    assetId: "b65ad865-b2bd-4d9c-93eb-f09f68f4db72",
    name: "vega-embed",
    version: "7.3.0",
    kind: "renderer",
    creator: "University of Washington Interactive Data Lab",
    license: "BSD-3-Clause",
    sha256: "d9a958ced3240f0418df7d5e12e97dba6e63cecda15b8403e47a0db7eb6ea859",
    sizeBytes: 159_306,
  },
  {
    assetId: "82e3abce-cf6e-4830-859a-1ea13126a313",
    name: "mathjs",
    version: "15.2.0",
    kind: "renderer",
    creator: "Jos de Jong and mathjs contributors",
    license: "Apache-2.0",
    sha256: "cb99d6e259c42193863aea504d694ac3fc6df4753ff126ccf8dcb9c441ce5451",
    sizeBytes: 1_715_036,
  },
  {
    assetId: "c4d08b4a-b243-42e8-97b9-0ddcba96ede3",
    name: "acorn",
    version: "8.19.0",
    kind: "renderer",
    creator: "Marijn Haverbeke and acorn contributors",
    license: "MIT",
    sha256: "c6fad21ffa1f2ba20338bf1dde1de911c2093c1aaf7b3af17c477661bd3bfaaf",
    sizeBytes: 134_282,
  },
  {
    assetId: "16e8d0b5-76e3-4a1e-b575-8b8ffa7ca67f",
    name: "matter-js",
    version: "0.20.0",
    kind: "simulation",
    creator: "Liam Brummitt",
    license: "MIT",
    sha256: "c2594c16b67adf76d32d9c4576a388a32cee80e5dfe2823cd3bf1b8fb93cc7f2",
    sizeBytes: 196_678,
  },
];

const REVIEW_OWNER = "Product owner";
// Libraries are re-reviewed yearly; the gate blocks them once this date has passed.
const LIBRARY_REVIEW_DUE = "2027-10-31";

function tarballUrl(name: string, version: string): string {
  const base = name.split("/").at(-1) ?? name;
  return `https://registry.npmjs.org/${name}/-/${base}-${version}.tgz`;
}

/** Rights records for the libraries ADR 0014's renderers load, applied by `pnpm seed:rights`. */
export const LIBRARY_ASSETS: readonly VisualAsset[] = LIBRARIES.map((library) => ({
  assetId: library.assetId,
  kind: library.kind,
  sourceUrl: tarballUrl(library.name, library.version),
  creator: library.creator,
  softwareLicense: { id: library.license, version: library.version },
  attribution: `${library.name} ${library.version}, ${library.creator}, ${library.license}`,
  modified: false,
  commercialUse: "allowed",
  sha256: library.sha256,
  format: "npm-tarball",
  sizeBytes: library.sizeBytes,
  accessibilityFallback: "The lesson text and the visual's own text description",
  reviewOwner: REVIEW_OWNER,
  reviewDueOn: LIBRARY_REVIEW_DUE,
  approvedLessonIds: [],
}));

export const LIBRARY_ASSET_IDS = Object.fromEntries(
  LIBRARIES.map((library) => [library.name, library.assetId]),
) as Readonly<Record<string, string>>;

/** The record for a spec or playground generated for one lesson: our own work, so no third party's terms. */
export function projectOutputAsset(input: {
  assetId: string;
  kind: VisualAsset["kind"];
  format: string;
  sha256: string;
  sizeBytes: number;
  accessibilityFallback: string;
  lessonId?: string;
}): VisualAsset {
  return {
    assetId: input.assetId,
    kind: input.kind,
    sourceUrl: `urn:sbi:visual-asset:${input.assetId}`,
    creator: "Science Behind It (generated for the lesson)",
    assetLicense: { id: "LicenseRef-SBI-project-output" },
    attribution: "Made by Science Behind It",
    modified: false,
    commercialUse: "allowed",
    sha256: input.sha256,
    format: input.format,
    sizeBytes: input.sizeBytes,
    accessibilityFallback: input.accessibilityFallback,
    reviewOwner: REVIEW_OWNER,
    approvedLessonIds: input.lessonId ? [input.lessonId] : [],
  };
}
