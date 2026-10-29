const STOPWORDS = new Set(
  "about above after again also among an and are as at be been before being between both but by can could did does doing down during each few for from further had has have having how into is it its itself just more most much must near not now of off on once only other our out over own same should so some such than that the their them then there these they this those through to too under until very was were what when where which while who whom why will with would you your".split(
    " ",
  ),
);

const flatten = (text: string) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/(\d)[\s\u2009\u202f,](?=\d{3}\b)/g, "$1")
    .replace(/\s+/g, " ");

// Crude stemming is enough to match "boils" with "boiling"; the judge handles meaning.
const stem = (word: string) => word.replace(/(ing|ed|es|s)$/, "");

const words = (text: string) => flatten(text).match(/[a-z][a-z-]+/g) ?? [];

// By value, so "4.0" in a source matches "4" in a claim.
const numbersIn = (text: string) =>
  (flatten(text).match(/\d+(?:\.\d+)?/g) ?? []).map((number) => String(Number(number)));

export interface TermProfile {
  numbers: string[];
  names: string[];
  content: string[];
}

/** The parts of a claim a supporting passage must share: figures, names and content words. */
export function claimTerms(text: string): TermProfile {
  const numbers = numbersIn(text);
  const names = [...text.matchAll(/(?<=\S\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g)].map((match) =>
    (match[1] ?? "").toLowerCase(),
  );
  const content = [
    ...new Set(words(text).filter((word) => word.length > 3 && !STOPWORDS.has(word))),
  ];
  return { numbers: [...new Set(numbers)], names: [...new Set(names)], content };
}

export interface TermMatch {
  passes: boolean;
  score: number;
}

// A cheap filter before the judge: every figure and name must appear, plus enough content words.
export function matchTerms(profile: TermProfile, passage: string): TermMatch {
  const flat = flatten(passage);
  const passageNumbers = new Set(numbersIn(passage));
  const passageStems = new Set(words(passage).map(stem));
  const numbersOk = profile.numbers.every((number) => passageNumbers.has(number));
  const namesOk = profile.names.every((name) => flat.includes(name));
  const shared = profile.content.filter((word) => passageStems.has(stem(word))).length;
  const score = profile.content.length === 0 ? 0 : shared / profile.content.length;
  // Matching figures already pin the topic, so one shared word is enough alongside them.
  const enough = profile.numbers.length > 0 ? shared > 0 : score >= 0.5;
  return { passes: numbersOk && namesOk && enough, score };
}
