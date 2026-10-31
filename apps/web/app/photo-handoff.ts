// The photo never leaves this device: its object URL passes to the lesson page for the loader.
let handed: string | null = null;

export function handOffPhoto(url: string | null) {
  if (handed && handed !== url) URL.revokeObjectURL(handed);
  handed = url;
}

export function handedOffPhoto(): string | null {
  return handed;
}
