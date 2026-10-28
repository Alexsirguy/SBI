export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
] as const;

const KNOWN_EXTENSIONS = ["jpg", "jpeg", "png", "heic", "heif"] as const;

// Some pickers filter only on extensions and others only on MIME types, so list both.
export const ACCEPTED_EXTENSIONS = [
  ...KNOWN_EXTENSIONS.map((extension) => `.${extension}`),
  ...ACCEPTED_IMAGE_TYPES,
].join(",");

export const ACCEPTED_FORMATS_LABEL = "JPG, PNG, HEIC";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function uploadLimitLabel(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

export const MAX_UPLOAD_LABEL = uploadLimitLabel(MAX_UPLOAD_BYTES);

export const PHOTO_RETENTION_DAYS = 7;

export interface SelectableFile {
  name: string;
  size: number;
  type: string;
}

// Browsers may report an empty MIME type (notably for HEIC), so fall back to extension.
export function validateSelection(
  file: SelectableFile,
  maxBytes = MAX_UPLOAD_BYTES,
): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const knownType = (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type);
  if (!knownType && !(KNOWN_EXTENSIONS as readonly string[]).includes(extension)) {
    return `“${file.name}” is not a photo. Choose a ${ACCEPTED_FORMATS_LABEL} file.`;
  }
  if (file.size === 0) {
    return `“${file.name}” is empty. Choose another photo.`;
  }
  if (file.size > maxBytes) {
    return `“${file.name}” is too large. Photos can be up to ${uploadLimitLabel(maxBytes)}.`;
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(0)} KB`;
  }
  return `${(kilobytes / 1024).toFixed(1)} MB`;
}
