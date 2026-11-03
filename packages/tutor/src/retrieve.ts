import type { Claim } from "@sbi/contracts";

/** Enough claims to answer a follow-up, few enough that the model can cite them precisely. */
export const RETRIEVED_CLAIMS = 6;

const STOP = new Set(
  "the and for are but not you your with that this what why how does did can was were from have has its into when then than they them their there which who will would about just also".split(
    " ",
  ),
);

function words(text: string): Set<string> {
  const found = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .match(/\p{L}{3,}/gu);
  return new Set((found ?? []).filter((word) => !STOP.has(word)));
}

/**
 * Ranks the lesson's own claims by shared words with the question and the last exchange.
 * Unmatched claims fill the rest in lesson order, so vague follow-ups still have context.
 */
export function retrieveClaims(
  claims: readonly Claim[],
  text: string,
  history: readonly { userText: string }[] = [],
  limit = RETRIEVED_CLAIMS,
): Claim[] {
  const query = words([text, history.at(-1)?.userText ?? ""].join(" "));
  const scored = claims.map((claim, index) => {
    let score = 0;
    for (const word of words(claim.text)) if (query.has(word)) score += 1;
    return { claim, index, score };
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.slice(0, limit).map((item) => item.claim);
}
