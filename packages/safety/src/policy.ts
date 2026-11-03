import type { AudienceBand, PolicyResponse, SafetyCategory, SuitableFor } from "@sbi/contracts";
import {
  AGE_HOLDS_ES,
  ANY_HARM_ES,
  CATEGORY_NOTICES_ES,
  isSpanish,
  REDIRECTS_ES,
} from "./policy-es";

/** Recorded on every lesson, so a policy change stops older lessons being reused. */
export const SAFETY_POLICY_VERSION = "safety-2";

const EMERGENCY = "If someone is in danger or hurt, call your local emergency number now.";
const POISON =
  "If someone may have swallowed, breathed in or touched something harmful, call your local poison control centre or emergency number.";

/** Shown first with a lesson on a risky topic: what it covers, what not to do, where to get help. */
export const CATEGORY_NOTICES: Readonly<Record<SafetyCategory, string>> = {
  medical:
    "Health and medicines: this lesson explains the science in general, not what to take or do. Never take or give a medicine because of it; ask a doctor, nurse or pharmacist. If someone may have taken too much, call your local poison control centre or emergency number.",
  "chemical-exposure":
    "Chemicals: this lesson explains the chemistry only. Never mix, taste, sniff or handle chemicals because of it; follow the label and ask a responsible adult. If someone swallows or breathes one in, call your local poison control centre or emergency number.",
  weapons:
    "Weapons: this lesson explains the science only, never how to make, get or use a weapon. Never handle one because of it. If someone is in danger, call your local emergency number.",
  "self-harm":
    "This topic can be hard to think about. If you are struggling or might hurt yourself, talk to someone you trust today, or call your local emergency number. Free, confidential helplines for your country are listed at findahelpline.com.",
  "dangerous-biology":
    "Living hazards: this lesson explains the biology only. Never touch, taste, collect or grow anything risky because of it, and keep away from wild animals. If someone is bitten, stung or poisoned, call your local poison control centre or emergency number.",
};

type Redirect = Omit<PolicyResponse, "policyVersion" | "reason">;

const REDIRECTS: Readonly<Record<SafetyCategory, Redirect>> = {
  "self-harm": {
    category: "self-harm",
    message:
      "It sounds like things might be really hard right now. We can't help with that question, but you don't have to deal with this alone.",
    help: [
      "If you might hurt yourself, call your local emergency number now.",
      "Talk to someone you trust today: a parent, carer, teacher, friend or doctor.",
      "Free, confidential helplines for your country are listed at findahelpline.com.",
    ],
  },
  weapons: {
    category: "weapons",
    message:
      "We can't help with making, getting or using weapons. We can explain the science behind how something works, safely.",
    help: ["Ask how it works or why it behaves as it does instead.", EMERGENCY],
  },
  medical: {
    category: "medical",
    message:
      "We can't advise on taking, giving or misusing medicines or drugs. We can explain how they work in the body in general.",
    help: ["Ask a doctor, nurse or pharmacist about any medicine.", POISON],
  },
  "chemical-exposure": {
    category: "chemical-exposure",
    message:
      "We can't help with mixing, making or using chemicals to cause harm. We can explain the chemistry behind them, safely.",
    help: ["Ask why a chemical behaves as it does instead.", POISON],
  },
  "dangerous-biology": {
    category: "dangerous-biology",
    message:
      "We can't help with growing, spreading or using germs, toxins or venom. We can explain how living things work, safely.",
    help: ["Ask how it works or why it behaves as it does instead.", POISON],
  },
};

const ANY_HARM: Redirect = {
  message:
    "We can't help with anything that could hurt you or someone else. We can explain the science behind how things work, safely.",
  help: ["Ask how it works or why it behaves as it does instead.", EMERGENCY],
};

/** The safety notice for a risky topic, in the learner's language. */
export function categoryNotice(category: SafetyCategory, locale?: string): string {
  return (isSpanish(locale) ? CATEGORY_NOTICES_ES : CATEGORY_NOTICES)[category];
}

/** The response sent instead of a lesson when a question seeks harm, in its category if known. */
export function policyResponse(category?: SafetyCategory, locale?: string): PolicyResponse {
  const english = category ? REDIRECTS[category] : ANY_HARM;
  const spanish = category ? REDIRECTS_ES[category] : ANY_HARM_ES;
  return {
    reason: "harm",
    ...english,
    ...(isSpanish(locale) ? { help: [...spanish.help], message: spanish.message } : {}),
    policyVersion: SAFETY_POLICY_VERSION,
  };
}

// "general" means no age was given, so only adults-only questions are held back from it.
const AGE_RANK: Readonly<Record<AudienceBand, number>> = {
  child: 0,
  general: 1,
  teen: 1,
  adult: 2,
};
const NEEDED_RANK: Readonly<Record<SuitableFor, number>> = { everyone: 0, teen: 1, adult: 2 };

const AGE_HOLDS: Readonly<Record<"teen" | "adult", Omit<PolicyResponse, "policyVersion">>> = {
  teen: {
    reason: "age",
    suitableFor: "teen",
    message:
      "This question is meant for teens and adults, so we haven't answered it for the age band you chose.",
    help: [
      "If you're a teen or an adult, change the age band and we'll answer it.",
      "Or explore it with a parent, carer or teacher.",
    ],
  },
  adult: {
    reason: "age",
    suitableFor: "adult",
    message:
      "This question is meant for adults, so we haven't answered it for the age band you chose.",
    help: [
      "If you're an adult, change the age band to Adult and we'll answer it.",
      "Or explore it with a parent, carer or teacher.",
    ],
  },
};

/** The note sent instead of a lesson when the question suits an older band than the one chosen. */
export function ageHold(
  audience: AudienceBand,
  risk: { suitableFor: SuitableFor; categories: readonly SafetyCategory[] },
  locale?: string,
): PolicyResponse | undefined {
  if (risk.suitableFor === "everyone" || AGE_RANK[audience] >= NEEDED_RANK[risk.suitableFor]) {
    return undefined;
  }
  // Someone young asking about self-harm may be struggling, so they get help, not a settings tip.
  if (risk.categories.includes("self-harm")) return policyResponse("self-harm", locale);
  const hold = AGE_HOLDS[risk.suitableFor];
  const spanish = isSpanish(locale) ? AGE_HOLDS_ES[risk.suitableFor] : undefined;
  return {
    ...hold,
    ...(spanish ? { help: [...spanish.help], message: spanish.message } : {}),
    policyVersion: SAFETY_POLICY_VERSION,
  };
}
