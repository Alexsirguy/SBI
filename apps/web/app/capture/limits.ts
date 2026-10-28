export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/heic"] as const;

export const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.heic";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const MAX_UPLOAD_LABEL = "10 MB";

export interface SelectableFile {
  name: string;
  size: number;
  type: string;
}

const KNOWN_EXTENSIONS = new Set(["jpg", "jpeg", "png", "heic"]);

// Browsers may report an empty MIME type (notably for HEIC), so fall back to extension.
export function validateSelection(file: SelectableFile): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const knownType = (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type);
  if (!knownType && !KNOWN_EXTENSIONS.has(extension)) {
    return `“${file.name}” is not a photo. Choose a JPG, PNG, or HEIC file.`;
  }
  if (file.size === 0) {
    return `“${file.name}” is empty. Choose another photo.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `“${file.name}” is too large. Photos must be under ${MAX_UPLOAD_LABEL}.`;
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
