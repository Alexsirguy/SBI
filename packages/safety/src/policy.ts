import type { PolicyResponse, SafetyCategory } from "@sbi/contracts";

/** Recorded on every lesson, so a policy change stops older lessons being reused. */
export const SAFETY_POLICY_VERSION = "safety-1";

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

const REDIRECTS: Readonly<Record<SafetyCategory, Omit<PolicyResponse, "policyVersion">>> = {
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

const ANY_HARM: Omit<PolicyResponse, "policyVersion"> = {
  message:
    "We can't help with anything that could hurt you or someone else. We can explain the science behind how things work, safely.",
  help: ["Ask how it works or why it behaves as it does instead.", EMERGENCY],
};

/** The response sent instead of a lesson when a question seeks harm, in its category if known. */
export function policyResponse(category?: SafetyCategory): PolicyResponse {
  return { ...(category ? REDIRECTS[category] : ANY_HARM), policyVersion: SAFETY_POLICY_VERSION };
}
