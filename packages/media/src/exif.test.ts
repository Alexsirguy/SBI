import exifr from "exifr";
import jpeg from "jpeg-js";
import { describe, expect, it } from "vitest";
import { sanitiseImage, stripJpegMetadata, stripMetadata, stripPngMetadata } from "./exif";
import {
  ICC_MARKER,
  SECRETS,
  cameraJpeg,
  plainJpeg,
  segment as jpegSegment,
} from "./fixtures/camera-jpeg";

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

// Only the JFIF header (version and pixel density) may remain; it identifies nothing.
const JFIF_FIELDS = new Set([
  "JFIFVersion",
  "ResolutionUnit",
  "XResolution",
  "YResolution",
  "ThumbnailWidth",
  "ThumbnailHeight",
]);

async function identifyingFields(bytes: Uint8Array): Promise<string[]> {
  const parsed: Record<string, unknown> = (await exifr.parse(bytes, true)) ?? {};
  return Object.keys(parsed).filter((key) => !JFIF_FIELDS.has(key) && key !== "errors");
}

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

describe("stripJpegMetadata on a real camera JPEG", () => {
  const original = cameraJpeg();
  const latin1 = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes);

  it("starts from a fixture that really carries GPS and device identifiers", async () => {
    const parsed = await exifr.parse(original, { gps: true, xmp: true });
    expect(parsed).toMatchObject({ Make: SECRETS.make, Model: SECRETS.model });
    expect(parsed.SerialNumber).toBe(SECRETS.serial);
    expect(parsed.latitude).toBeCloseTo(51.5074, 3);
    expect(parsed.longitude).toBeCloseTo(-0.1277, 3);
  });

  it("leaves no GPS position or device identifiers for an EXIF reader to find", async () => {
    const stripped = stripJpegMetadata(original);
    expect(await identifyingFields(stripped)).toEqual([]);
    expect(await exifr.gps(stripped)).toBeUndefined();
    for (const secret of Object.values(SECRETS)) {
      expect(latin1(stripped)).not.toContain(secret);
    }
    expect(latin1(stripped)).not.toContain("GPSLatitude");
    expect(latin1(stripped)).not.toContain("trailing-maker-note");
  });

  it("keeps the colour profile and still decodes to the same pixels", () => {
    const stripped = stripJpegMetadata(original);
    expect(latin1(stripped)).toContain(ICC_MARKER);
    const before = jpeg.decode(plainJpeg());
    const after = jpeg.decode(stripped);
    expect([after.width, after.height]).toEqual([before.width, before.height]);
    expect(Buffer.from(after.data).equals(Buffer.from(before.data))).toBe(true);
  });

  it("drops metadata hidden between the scans of a progressive JPEG", () => {
    const scan = (bytes: number[]) =>
      new Uint8Array([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, ...bytes]);
    const progressive = new Uint8Array([
      0xff,
      0xd8,
      ...jpegSegment(0xc2, "frame"),
      ...scan([0x11, 0xff, 0x00, 0x22, 0xff, 0xd0, 0x33]),
      ...jpegSegment(0xe1, `Exif\0\0${SECRETS.serial}`),
      ...jpegSegment(0xc4, "huffman"),
      ...scan([0x44, 0x55]),
      0xff,
      0xd9,
    ]);

    const stripped = stripJpegMetadata(progressive);
    expect(latin1(stripped)).not.toContain(SECRETS.serial);
    expect(latin1(stripped)).toContain("huffman");
    expect([...stripped.subarray(-4)]).toEqual([0x44, 0x55, 0xff, 0xd9]);
    expect(latin1(stripped)).toContain(
      latin1(new Uint8Array([0x11, 0xff, 0x00, 0x22, 0xff, 0xd0, 0x33])),
    );
  });
});

describe("sanitiseImage", () => {
  it("identifies the type from the bytes and strips accordingly", async () => {
    const result = sanitiseImage(cameraJpeg());
    expect(result.type).toBe("image/jpeg");
    expect(await identifyingFields(result.bytes)).toEqual([]);
  });

  it("refuses bytes that are not a supported image, whatever they claim to be", () => {
    expect(() => sanitiseImage(new TextEncoder().encode("<svg/>"))).toThrow(
      "Unsupported image type",
    );
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
