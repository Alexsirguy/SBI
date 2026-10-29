const STOPWORDS = new Set(
  "a an and are as at be by can do does for from how in into is it its of on or that the their this to what when where which why with you your vs".split(
    " ",
  ),
);

// Crude stemming so "gears" finds "Gear" and "heating" finds "Heat"; ranking, not meaning.
const stem = (word: string) => word.replace(/(ings?|ed|es|s)$/, "");

/** Lowercase content words, stemmed, for matching queries against page titles. */
export function searchTokens(text: string): string[] {
  return (
    text
      .normalize("NFKC")
      .toLowerCase()
      .match(/[a-z][a-z0-9-]+/g) ?? []
  )
    .filter((word) => word.length > 2 && !STOPWORDS.has(word))
    .map(stem);
}
