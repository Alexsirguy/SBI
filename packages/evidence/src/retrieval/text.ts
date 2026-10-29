import { createHash } from "node:crypto";
import type { Passage } from "./types";

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  deg: "°",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name: string) => {
    if (name.startsWith("#x") || name.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    }
    if (name.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    }
    return ENTITIES[name.toLowerCase()] ?? match;
  });
}

export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

const NON_CONTENT = [
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "header",
  "nav",
  "footer",
  "aside",
  "form",
];

/** Body paragraphs only: site chrome would otherwise turn into citable "evidence". */
export function htmlParagraphs(html: string): string[] {
  let content = html;
  for (const tag of NON_CONTENT) {
    content = content.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, "gi"), " ");
  }
  const region =
    /<main\b[\s\S]*?<\/main>/i.exec(content)?.[0] ??
    /<article\b[\s\S]*?<\/article>/i.exec(content)?.[0] ??
    content;
  return [...region.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripTags(match[1] ?? ""))
    .filter((text) => text.length >= 40 && /[.!?]/.test(text));
}

export function htmlTitle(html: string): string | undefined {
  const raw = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const title = raw ? stripTags(raw).split(" | ")[0]?.trim() : undefined;
  return title || undefined;
}

/** Splits a JATS or HTML abstract at its headings, so excerpts can cite "Abstract, Methods". */
export function abstractPassages(abstract: string): Passage[] {
  const parts = abstract.split(/<(?:h\d|jats:title)\b[^>]*>([\s\S]*?)<\/(?:h\d|jats:title)>/i);
  const passages: Passage[] = [];
  const lead = stripTags(parts[0] ?? "");
  if (lead) passages.push({ location: "Abstract", text: lead });
  for (let index = 1; index < parts.length; index += 2) {
    const text = stripTags(parts[index + 1] ?? "");
    if (text) passages.push({ location: `Abstract, ${stripTags(parts[index] ?? "")}`, text });
  }
  return passages;
}

export function contentSha256(passages: Passage[]): string {
  const hash = createHash("sha256");
  for (const passage of passages) hash.update(`${passage.location}\n${passage.text}\n`);
  return hash.digest("hex");
}
