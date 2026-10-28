export type StrippableImageType = "image/jpeg" | "image/png";

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

// JPEG metadata lives in APPn/COM segments; image data after SOS is copied verbatim.
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  const data = view(bytes);
  if (bytes.length < 4 || data.getUint16(0) !== 0xffd8) {
    throw new Error("Not a JPEG file.");
  }
  const kept: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      throw new Error("Corrupt JPEG data.");
    }
    let marker = bytes.at(offset + 1);
    if (marker === undefined) {
      throw new Error("Truncated JPEG data.");
    }
    // Byte stuffing and RSTn markers carry no segment header.
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    while (marker === 0xff) {
      offset += 1;
      const next = bytes.at(offset + 1);
      if (next === undefined) {
        throw new Error("Truncated JPEG data.");
      }
      marker = next;
    }
    if (marker === 0xd9) {
      kept.push(bytes.subarray(offset, offset + 2));
      return concat(kept);
    }
    if (marker === 0xd8 || marker === 0x01) {
      kept.push(bytes.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    const length = data.getUint16(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) {
      throw new Error("Corrupt JPEG segment.");
    }
    const segment = bytes.subarray(offset, offset + 2 + length);
    const droppable = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
    if (!droppable) {
      kept.push(segment);
    }
    offset += 2 + length;
    if (marker === 0xda) {
      // Entropy-coded data follows; only EOI can still matter.
      const rest = bytes.subarray(offset);
      const end = findEoi(rest);
      if (end === -1) {
        throw new Error("Truncated JPEG data.");
      }
      kept.push(rest.subarray(0, end + 2));
      return concat(kept);
    }
  }
  throw new Error("Truncated JPEG data.");
}

function findEoi(bytes: Uint8Array): number {
  for (let i = 0; i + 1 < bytes.length; i += 1) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) {
      return i;
    }
  }
  return -1;
}

// PNG text/exif chunks identify the capture; image and color chunks are kept.
const DROPPABLE_PNG_CHUNKS = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);

export function stripPngMetadata(bytes: Uint8Array): Uint8Array {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 8 || !signature.every((byte, i) => bytes[i] === byte)) {
    throw new Error("Not a PNG file.");
  }
  const data = view(bytes);
  const kept: Uint8Array[] = [bytes.subarray(0, 8)];
  let offset = 8;
  let seenIhdr = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) {
      throw new Error("Truncated PNG chunk.");
    }
    const length = data.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const end = offset + 12 + length;
    if (end > bytes.length) {
      throw new Error("Truncated PNG chunk.");
    }
    if (!seenIhdr && type !== "IHDR") {
      throw new Error("Corrupt PNG data.");
    }
    seenIhdr = true;
    if (!DROPPABLE_PNG_CHUNKS.has(type)) {
      kept.push(bytes.subarray(offset, end));
    }
    offset = end;
    if (type === "IEND") {
      return concat(kept);
    }
  }
  throw new Error("Truncated PNG data.");
}

export function stripMetadata(bytes: Uint8Array, type: StrippableImageType): Uint8Array {
  return type === "image/jpeg" ? stripJpegMetadata(bytes) : stripPngMetadata(bytes);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
