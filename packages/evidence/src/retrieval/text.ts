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

// Inline markup sits inside words ("SiO<sub>2</sub>"), so it is removed without a space.
const INLINE_TAGS = /<\/?(?:sub|sup|i|b|em|strong|italic|bold|span|a|u|small)\b[^>]*>/gi;

export function stripTags(html: string): string {
  return decodeEntities(html.replace(INLINE_TAGS, "").replace(/<[^>]*>/g, " "))
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
  const paragraphs = [...region.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripTags(match[1] ?? ""))
    .filter((text) => text.length >= 40 && /[.!?]/.test(text));
  // Pages often repeat a paragraph (teaser and body); one copy is enough to cite.
  return [...new Set(paragraphs)];
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

/** Normalises case, spacing and curly quotes, so the same words compare equal across fetches. */
export function comparableText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const MAX_PASSAGES = 400;

interface TableRows {
  label: string;
  headers: string[];
  rows: string[][];
}

const cells = (row: string) =>
  [...row.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((match) =>
    stripTags(match[1] ?? ""),
  );

function parseTable(table: string, label: string): TableRows {
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[0]);
  const headerRow = rows.find((row) => /<th\b/i.test(row));
  return {
    label,
    headers: headerRow ? cells(headerRow) : [],
    rows: rows.filter((row) => row !== headerRow).map(cells),
  };
}

// One passage per row, with its headers, so a figure is cited with what it measures.
function rowPassages({ label, headers, rows }: TableRows): Passage[] {
  return rows
    .map((row, index) => ({
      location: `${label}, row ${index + 1}`,
      text: `${label}: ${row
        .map((cell, column) => (headers[column] ? `${headers[column]}: ${cell}` : cell))
        .join("; ")}`,
    }))
    .filter((passage) => passage.text.length > label.length + 4);
}

/** Tables in a page's main content, one passage per row; plain-text extracts drop these. */
export function htmlTablePassages(html: string): Passage[] {
  const region = /<main\b[\s\S]*?<\/main>/i.exec(html)?.[0] ?? html;
  const seen = new Set<string>();
  return [...region.matchAll(/<table\b[\s\S]*?<\/table>/gi)].flatMap((match, index) => {
    const caption = /<caption\b[^>]*>([\s\S]*?)<\/caption>/i.exec(match[0])?.[1];
    const label = caption ? `Table ${index + 1} (${stripTags(caption)})` : `Table ${index + 1}`;
    const table = parseTable(match[0], label);
    // Responsive pages often print the same table twice; one copy is enough to cite.
    const key = JSON.stringify([table.headers, table.rows]);
    if (seen.has(key)) return [];
    seen.add(key);
    return rowPassages(table);
  });
}

/** Body paragraphs under their section titles, then table rows, from a JATS full-text article. */
export function jatsPassages(xml: string): Passage[] {
  const body = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(xml)?.[1] ?? "";
  const tables = [...body.matchAll(/<table-wrap\b[\s\S]*?<\/table-wrap>/gi)].flatMap((match) => {
    const label = stripTags(/<label\b[^>]*>([\s\S]*?)<\/label>/i.exec(match[0])?.[1] ?? "Table");
    const caption = stripTags(/<caption\b[^>]*>([\s\S]*?)<\/caption>/i.exec(match[0])?.[1] ?? "");
    return rowPassages(parseTable(match[0], caption ? `${label} (${caption})` : label));
  });
  const text = body.replace(/<(table-wrap|fig|disp-formula)\b[\s\S]*?<\/\1>/gi, " ");
  const passages: Passage[] = [];
  let section = "Body";
  let paragraph = 0;
  for (const match of text.matchAll(
    /<title\b[^>]*>([\s\S]*?)<\/title>|<p\b[^>]*>([\s\S]*?)<\/p>/gi,
  )) {
    if (match[1] !== undefined) {
      section = stripTags(match[1]) || section;
      paragraph = 0;
      continue;
    }
    const paragraphText = stripTags(match[2] ?? "");
    if (paragraphText.length < 40) continue;
    paragraph += 1;
    passages.push({ location: `${section}, paragraph ${paragraph}`, text: paragraphText });
  }
  return [...passages, ...tables].slice(0, MAX_PASSAGES);
}
