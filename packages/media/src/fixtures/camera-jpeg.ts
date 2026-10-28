import jpeg from "jpeg-js";

export const SECRETS = {
  make: "SBI-TestCam",
  model: "Model-X9",
  serial: "SN-0042-SECRET",
  xmpCreator: "Jane Learner",
  iptcByline: "Byline Jane",
  comment: "taken at home",
} as const;

export const ICC_MARKER = "ICC_PROFILE";

type Entry =
  | { tag: number; type: "ascii"; value: string }
  | { tag: number; type: "long"; value: number }
  | { tag: number; type: "rational"; value: [number, number][] };

const TYPE_CODES = { ascii: 2, long: 4, rational: 5 } as const;

function payload(entry: Entry): number[] {
  if (entry.type === "ascii") {
    return [...new TextEncoder().encode(entry.value), 0];
  }
  if (entry.type === "long") {
    return u32(entry.value);
  }
  return entry.value.flatMap(([numerator, denominator]) => [
    ...u32(numerator),
    ...u32(denominator),
  ]);
}

function u16(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff];
}

function u32(value: number): number[] {
  return [...u16(value >>> 16), ...u16(value & 0xffff)];
}

// Writes one big-endian IFD at `start`, with values over 4 bytes in a trailing data area.
function ifd(entries: Entry[], start: number): number[] {
  const headerSize = 2 + entries.length * 12 + 4;
  const table: number[] = [...u16(entries.length)];
  const data: number[] = [];
  for (const entry of entries) {
    const bytes = payload(entry);
    const count = entry.type === "rational" ? entry.value.length : bytes.length;
    const countField = entry.type === "long" ? 1 : count;
    table.push(...u16(entry.tag), ...u16(TYPE_CODES[entry.type]), ...u32(countField));
    if (bytes.length <= 4) {
      table.push(...bytes, ...new Array<number>(4 - bytes.length).fill(0));
    } else {
      table.push(...u32(start + headerSize + data.length));
      data.push(...bytes);
      if (data.length % 2) {
        data.push(0);
      }
    }
  }
  return [...table, ...u32(0), ...data];
}

// TIFF block as cameras write it: IFD0 points at an Exif IFD and a GPS IFD.
export function cameraTiff(): Uint8Array {
  const gps: Entry[] = [
    { tag: 0x0001, type: "ascii", value: "N" },
    {
      tag: 0x0002,
      type: "rational",
      value: [
        [51, 1],
        [30, 1],
        [2664, 100],
      ],
    },
    { tag: 0x0003, type: "ascii", value: "W" },
    {
      tag: 0x0004,
      type: "rational",
      value: [
        [0, 1],
        [7, 1],
        [3960, 100],
      ],
    },
  ];
  const exif: Entry[] = [{ tag: 0xa431, type: "ascii", value: SECRETS.serial }];
  const ifd0 = (exifAt: number, gpsAt: number): Entry[] => [
    { tag: 0x010f, type: "ascii", value: SECRETS.make },
    { tag: 0x0110, type: "ascii", value: SECRETS.model },
    { tag: 0x8769, type: "long", value: exifAt },
    { tag: 0x8825, type: "long", value: gpsAt },
  ];
  const ifd0Length = ifd(ifd0(0, 0), 8).length;
  const exifAt = 8 + ifd0Length;
  const exifBytes = ifd(exif, exifAt);
  const gpsAt = exifAt + exifBytes.length;
  const tiff = [
    0x4d,
    0x4d,
    ...u16(42),
    ...u32(8),
    ...ifd(ifd0(exifAt, gpsAt), 8),
    ...exifBytes,
    ...ifd(gps, gpsAt),
  ];
  return new Uint8Array(tiff);
}

export function segment(marker: number, body: Uint8Array | string): Uint8Array {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
  return new Uint8Array([0xff, marker, ...u16(bytes.length + 2), ...bytes]);
}

function join(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function plainJpeg(width = 16, height = 16): Uint8Array {
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels.set([(i * 7) % 256, (i * 3) % 256, (i * 11) % 256, 255], i);
  }
  return new Uint8Array(jpeg.encode({ data: pixels, height, width }, 90).data);
}

// A real, decodable JPEG carrying every metadata block a phone camera might write.
export function cameraJpeg(): Uint8Array {
  const base = plainJpeg();
  const exif = join([new TextEncoder().encode("Exif\0\0"), cameraTiff()]);
  const xmp = `http://ns.adobe.com/xap/1.0/\0<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:exif="http://ns.adobe.com/exif/1.0/"><dc:creator>${SECRETS.xmpCreator}</dc:creator><exif:GPSLatitude>51,30.444N</exif:GPSLatitude></rdf:Description></rdf:RDF></x:xmpmeta>`;
  const icc = join([
    new TextEncoder().encode(`${ICC_MARKER}\0`),
    new Uint8Array([1, 1]),
    new TextEncoder().encode("profile-bytes"),
  ]);
  return join([
    base.subarray(0, 2),
    segment(0xe1, exif),
    segment(0xe1, xmp),
    segment(0xe2, icc),
    segment(0xed, `Photoshop 3.0\0${SECRETS.iptcByline}`),
    segment(0xfe, SECRETS.comment),
    base.subarray(2),
    new TextEncoder().encode("trailing-maker-note"),
  ]);
}
