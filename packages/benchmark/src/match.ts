import type { SeedPrompt } from "./seed-set";

function singular(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ves")) return `${word.slice(0, -3)}f`;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (/(ss|x|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function normalise(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(singular)
    .join(" ");
}

/** True when a free-text label names the prompt's object or one of its aliases. */
export function labelMatches(label: string, prompt: SeedPrompt): boolean {
  const candidate = normalise(label);
  if (candidate.length < 3) return false;
  return [prompt.label, ...prompt.aliases].some((term) => {
    const target = normalise(term);
    return target.length >= 3 && (candidate.includes(target) || target.includes(candidate));
  });
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
}

export function rate(hits: number, total: number): number | null {
  return total === 0 ? null : Math.round((hits / total) * 1000) / 1000;
}
