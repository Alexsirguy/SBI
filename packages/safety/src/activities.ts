import type { AudienceBand } from "@sbi/contracts";

/** The activities spec §12 says a lesson must never ask a younger learner to do. */
export type ActivityHazard =
  "unknown-substance" | "mains-device" | "ingestion" | "wildlife" | "hazardous-experiment";

export interface ActivityFinding {
  hazard: ActivityHazard;
  /** The sentence that asks for it, so a rewrite knows what to change. */
  sentence: string;
}

const HAZARDS: readonly (readonly [ActivityHazard, RegExp])[] = [
  [
    "unknown-substance",
    /\b(mix|mixing|combine|pour|sniff|smell|touch|handle|rub|test)\b[^.!?]{0,40}\b(chemicals?|cleaning (products?|sprays?|fluids?)|bleach|unknown|unlabell?ed|solvents?|substances?|anything under the sink|detergents?)\b/,
  ],
  [
    "mains-device",
    /\b(unscrew|take apart|taking apart|dismantle|disassemble|open up|pry open|prise open|cut open|take (the )?(back|cover|casing|lid) off)\b[^.!?]{0,40}\b(plugs?|sockets?|outlets?|appliances?|chargers?|microwaves?|toasters?|kettles?|hair ?dryers?|lamps?|tvs?|televisions?|power supply|power supplies|fridges?|washing machines?|cables?|cords?|wires?)\b/,
  ],
  [
    "mains-device",
    /\b(insert|stick|poke|push|put)\b[^.!?]{0,30}\b(into|in) (a|the) (socket|outlet|plug socket|power point)\b/,
  ],
  [
    "ingestion",
    /\b(eat|taste|lick|swallow|drink|chew|sip|nibble)\b[^.!?]{0,30}\b(wild|berr(y|ies)|mushrooms?|toadstools?|leaf|leaves|plants?|seeds?|flowers?|soil|mud|chemicals?|medicines?|pills?|tablets?|the (liquid|powder|mixture|solution|crystals?))\b/,
  ],
  [
    "wildlife",
    /\b(touch|pick up|hold|catch|feed|stroke|pet|approach|chase|poke|handle|get close to|go near|disturb)\b[^.!?]{0,30}\b(wild|bees?|wasps?|hornets?|snakes?|spiders?|scorpions?|jellyfish|bats?|fox(es)?|birds?|nests?|toads?|frogs?|caterpillars?|stray (dogs?|cats?)|squirrels?|swans?|geese|ticks?)\b/,
  ],
  [
    "hazardous-experiment",
    /\b(light|set fire to|burn|ignite|heat|boil|melt|microwave)\b[^.!?]{0,40}\b(match(es)?|lighters?|candles?|fire|flames?|stove|hob|cooker|oven|metal|foil|batter(y|ies))\b/,
  ],
  ["hazardous-experiment", /\b(short[- ]circuit|connect (both|the two) ends of a battery)\b/],
  ["hazardous-experiment", /\b(foil|metal|forks?|spoons?)\b[^.!?]{0,30}\bmicrowave\b/],
  [
    "hazardous-experiment",
    /\b(cut|slice|carve|chop)\b[^.!?]{0,30}\b(knife|knives|blade|razor|saw)\b/,
  ],
];

// "Never touch a wasp" is safety advice and "imagine opening it" a thought experiment, not activities.
const ADVICE =
  /\b(never|don'?t|do not|avoid|without (touching|tasting|opening)|imagine|picture|what would happen if)\b/;
// Heat and blades are fine with an adult doing it; mains, ingestion and wildlife never are.
const SUPERVISED = /\b(an adult|a grown-?up|a parent|a carer|your (parent|carer|teacher))\b/;

/** Each sentence that asks the learner to do one of the hazardous activities. */
export function findUnsafeActivities(text: string): ActivityFinding[] {
  const findings: ActivityFinding[] = [];
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const lower = sentence.toLowerCase();
    if (ADVICE.test(lower)) continue;
    const hazard = HAZARDS.find(
      ([kind, pattern]) =>
        pattern.test(lower) && !(kind === "hazardous-experiment" && SUPERVISED.test(lower)),
    )?.[0];
    if (hazard) findings.push({ hazard, sentence: sentence.trim() });
  }
  return findings;
}

/** Everyone but adults may be a child, so the rules hold unless a lesson is for adults only. */
export function safeActivityRulesApply(audience: readonly AudienceBand[]): boolean {
  return audience.some((band) => band !== "adult");
}

/** The rule a draft is given up front, so few lessons need the check's rewrite. */
export const SAFE_ACTIVITY_RULE =
  "Activities: a child may read this lesson. Never ask the learner to touch, mix, smell or taste an unknown substance or chemical; to open, take apart or poke into anything plugged into the mains; to eat, taste or drink anything that is not ordinary food; to touch, feed or approach wild animals or insects; or to use fire, a stove, a knife or batteries in a hazardous way. Suggest something to notice, compare or imagine instead.";

const HAZARD_WORDS: Readonly<Record<ActivityHazard, string>> = {
  "unknown-substance": "handle or mix an unknown substance or chemical",
  "mains-device": "open or poke into a mains-powered device",
  ingestion: "eat, taste or drink something that is not ordinary food",
  wildlife: "touch, feed or approach a wild animal",
  "hazardous-experiment": "do a hazardous experiment with fire, heat, blades or batteries",
};

/** Why a sentence fails, in words a rewrite can act on. */
export function activityReason(finding: ActivityFinding): string {
  return `Asks the learner to ${HAZARD_WORDS[finding.hazard]}: "${finding.sentence}". Rewrite it as something safe to notice, compare or imagine, with nothing to touch, taste, open, mix or approach.`;
}
