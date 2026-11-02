import type { AssetCredit, VisualAsset } from "@sbi/contracts";

// Plain names for the licences we record; an unknown id is shown as recorded.
const LICENSE_LABELS: Readonly<Record<string, string>> = {
  "CC0-1.0": "CC0 1.0 (public domain)",
  "CC-BY-4.0": "CC BY 4.0",
  "CC-BY-SA-4.0": "CC BY-SA 4.0",
  "CC-BY-3.0": "CC BY 3.0",
  "CC-BY-SA-3.0": "CC BY-SA 3.0",
  "ODbL-1.0": "Open Database License 1.0",
  "LicenseRef-NCBI-PubChem-data": "NCBI data policy (free to use)",
  "LicenseRef-public-domain": "Public domain",
};

const LICENSE_URLS: Readonly<Record<string, string>> = {
  "CC0-1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
  "CC-BY-4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC-BY-SA-4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
  "CC-BY-3.0": "https://creativecommons.org/licenses/by/3.0/",
  "CC-BY-SA-3.0": "https://creativecommons.org/licenses/by-sa/3.0/",
  "ODbL-1.0": "https://opendatacommons.org/licenses/odbl/1-0/",
};

// Copyleft terms for media and data: reuse or adaptation must carry the same licence.
const SHARE_ALIKE = /(^|-)SA(-|$)|^ODbL|^GFDL/i;

/** True when reusing or adapting work under this licence must keep the same licence. */
export function isShareAlike(licenseId: string): boolean {
  return SHARE_ALIKE.test(licenseId);
}

// None for our own work, or for software, whose notice belongs with the code, not the picture.
/** The credit a lesson shows for one asset. */
export function creditFor(asset: VisualAsset): AssetCredit | undefined {
  const license = asset.assetLicense;
  if (!license || license.id === "LicenseRef-SBI-project-output") return undefined;
  const changes = asset.modified ? asset.modificationNotes : undefined;
  const label = LICENSE_LABELS[license.id] ?? license.id;
  const url = license.url ?? LICENSE_URLS[license.id];
  return {
    assetId: asset.assetId,
    text: [asset.attribution, label, changes ? "changed" : undefined].filter(Boolean).join(", "),
    itemUrl: /^https?:\/\//.test(asset.sourceUrl) ? asset.sourceUrl : undefined,
    license: url ? { label, url } : { label },
    shareAlike: isShareAlike(license.id),
    ...(changes ? { changes } : {}),
  };
}
