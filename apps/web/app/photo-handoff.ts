// The photo never leaves this device: its object URL passes to the lesson page for the loader.
let handed: { url: string; label: string } | null = null;

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Hands the photo on for lessons about `label`; null forgets it, as a new object without one does. */
export function handOffPhoto(url: string | null, label = "") {
  if (handed && handed.url !== url) URL.revokeObjectURL(handed.url);
  handed = url ? { url, label } : null;
}

/** The photo of this object, or of any object when no label is given; another object's photo never shows. */
export function handedOffPhoto(label?: string): string | null {
  if (!handed) return null;
  return label === undefined || same(handed.label, label) ? handed.url : null;
}
