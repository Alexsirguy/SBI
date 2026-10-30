import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no ${selector} block`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/(--sbi-[a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((match) => [
      match[1] as string,
      (match[2] as string).toLowerCase(),
    ]),
  );
}

const light = block(":root");
const dark = block(':root[data-theme="dark"]');
const mediaDark = block(':root:not([data-theme="light"])');

function luminance(hex: string): number {
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

// [foreground, background] pairs as the components use them.
const TEXT_PAIRS = [
  ["ink", "paper"],
  ["ink", "bench"],
  ["ink", "paper-sunk"],
  ["ink-soft", "paper"],
  ["ink-soft", "paper-sunk"],
  ["ink-soft", "bench"],
  ["action", "paper"],
  ["action", "paper-sunk"],
  ["action-ink", "action"],
  // Highlighted text always takes marker-ink: light ink on the highlighter fails in dark mode.
  ["marker-ink", "marker"],
  ["caution-ink", "caution"],
  ["ink", "caution-wash"],
  ["caution", "caution-wash"],
  ["note", "note-wash"],
  ["ink", "note-wash"],
] as const;

// Borders, focus rings and stripes that identify a control or state (WCAG 1.4.11).
const UI_PAIRS = [
  ["control-edge", "paper"],
  ["action", "paper"],
  ["focus", "paper"],
  ["focus", "bench"],
  ["caution", "paper"],
  ["note", "paper"],
] as const;

describe.each([
  ["light", light],
  ["dark", dark],
])("Workbench tokens (%s)", (_name, theme) => {
  const colour = (token: string) => {
    const value = theme[`--sbi-${token}`];
    if (!value) throw new Error(`missing --sbi-${token}`);
    return value;
  };

  it.each(TEXT_PAIRS)("%s on %s is readable text (AA 4.5:1)", (fg, bg) => {
    expect(contrast(colour(fg), colour(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI_PAIRS)("%s against %s is a visible control edge (AA 3:1)", (fg, bg) => {
    expect(contrast(colour(fg), colour(bg))).toBeGreaterThanOrEqual(3);
  });
});

describe("dark theme", () => {
  it("redefines every colour, the same way for the device setting and the explicit choice", () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
    expect(mediaDark).toEqual(dark);
  });
});
