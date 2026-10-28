import { describe, expect, it } from "vitest";
import { stripJpegMetadata, stripMetadata, stripPngMetadata } from "./exif";

function segment(marker: number, payload: string): Uint8Array {
  const text = new TextEncoder().encode(payload);
  const out = new Uint8Array(2 + 2 + text.length);
  out[0] = 0xff;
  out[1] = marker;
  new DataView(out.buffer).setUint16(2, text.length + 2);
  out.set(text, 4);
  return out;
}

function chunk(type: string, payload: string): Uint8Array {
  const text = new TextEncoder().encode(payload);
  const out = new Uint8Array(12 + text.length);
  new DataView(out.buffer).setUint32(0, text.length);
  for (let i = 0; i < 4; i += 1) {
    out[4 + i] = type.charCodeAt(i);
  }
  out.set(text, 8);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const GPS = "GPSLatitude 51.5074N";

describe("stripJpegMetadata", () => {
  it("removes EXIF and comment segments while keeping image data intact", () => {
    const sosHeader = new Uint8Array([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]);
    const entropy = new Uint8Array([0x11, 0x22, 0xff, 0x00, 0x33, 0x44]);
    const jpeg = concat([
      new Uint8Array([0xff, 0xd8]),
      segment(0xe1, `Exif\0\0${GPS}`),
      segment(0xfe, "Comment Device Pixel"),
      segment(0xdb, "QuantTable"),
      sosHeader,
      entropy,
      new Uint8Array([0xff, 0xd9]),
    ]);

    const stripped = stripJpegMetadata(jpeg);
    const text = new TextDecoder("latin1").decode(stripped);
    expect(text).not.toContain("GPS");
    expect(text).not.toContain("Device Pixel");
    expect(text).toContain("QuantTable");

    const sosIndex = stripped.findIndex((_, i) => stripped[i] === 0xff && stripped[i + 1] === 0xda);
    expect([...stripped.subarray(sosIndex, sosIndex + sosHeader.length)]).toEqual([...sosHeader]);
    expect([...stripped.subarray(-8)]).toEqual([...entropy, 0xff, 0xd9]);
  });

  it("rejects non-JPEG and truncated input", () => {
    expect(() => stripJpegMetadata(new Uint8Array([1, 2, 3, 4]))).toThrow("Not a JPEG");
    expect(() => stripJpegMetadata(new Uint8Array([0xff, 0xd8, 0xff]))).toThrow();
  });
});

describe("stripPngMetadata", () => {
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  it("removes text and exif chunks while keeping image data intact", () => {
    const idat = chunk("IDAT", "imagedata");
    const png = concat([
      signature,
      chunk("IHDR", "header"),
      chunk("tEXt", "Author Device"),
      chunk("eXIf", GPS),
      idat,
      chunk("IEND", ""),
    ]);

    const stripped = stripPngMetadata(png);
    const text = new TextDecoder("latin1").decode(stripped);
    expect(text).not.toContain("Device");
    expect(text).not.toContain("GPS");
    expect(text).toContain("imagedata");
    expect([...stripped.subarray(0, 8)]).toEqual([...signature]);
    expect(new TextDecoder().decode(stripped.subarray(-8, -4))).toBe("IEND");
  });

  it("rejects non-PNG and truncated input", () => {
    expect(() => stripPngMetadata(new Uint8Array(8))).toThrow("Not a PNG");
    expect(() => stripPngMetadata(concat([signature, chunk("IHDR", "x")]))).toThrow("Truncated");
  });
});

describe("stripMetadata", () => {
  it("dispatches on MIME type for the client and server paths", () => {
    const jpeg = concat([new Uint8Array([0xff, 0xd8]), segment(0xe1, GPS)]);
    expect(() => stripMetadata(jpeg, "image/jpeg")).toThrow("Truncated");
    expect(() => stripMetadata(new Uint8Array(8), "image/png")).toThrow("Not a PNG");
  });
});
