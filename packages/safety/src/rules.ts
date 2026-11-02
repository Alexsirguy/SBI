import type { SafetyCategory } from "@sbi/contracts";

// Toys, tools and crafts named after weapons: "bath bomb", "water gun", "glue gun".
const NOT_A_WEAPON =
  "(?<!\\b(glue|water|nail|staple|squirt|heat|spray|nerf|toy|bath|bubble|seed|glitter|paper|paint|massage|ray|radar|speed|potato|spud|cap|pop|bug|flour|calorie|stink) )";

// A floor the model can raise but never lower: plain names for each category's riskiest topics.
const TOPICS: readonly (readonly [SafetyCategory, RegExp])[] = [
  [
    "medical",
    /\b(medicines?|medications?|pills?|painkillers?|paracetamol|acetaminophen|ibuprofen|aspirin|antibiotics?|opioids?|insulin|inhalers?|syringes?|dosage|overdos(e|es|ing)|prescription drugs?|vaccines?)\b/,
  ],
  [
    "chemical-exposure",
    /\b(bleach|ammonia|detergents?|disinfectants?|household chemicals?|solvents?|pesticides?|insecticides?|weedkillers?|herbicides?|lye|caustic|drain cleaners?|oven cleaners?|cleaning (products?|sprays?|fluids?)|antifreeze|carbon monoxide|mercury|asbestos|lead paint|chlorine gas)\b/,
  ],
  [
    "weapons",
    new RegExp(
      `${NOT_A_WEAPON}\\b(guns?|firearms?|rifles?|pistols?|shotguns?|revolvers?|ammunition|explosives?|bombs?|grenades?|gunpowder|dynamite|crossbows?|landmines?|napalm|weapons?)\\b`,
    ),
  ],
  [
    "self-harm",
    /\b(suicid(e|al)|self[- ]harm(ing)?|self[- ]injur(y|ies)|cutting myself|hang(ing)? myself|kill(ing)? myself|end(ing)? my life)\b/,
  ],
  [
    "dangerous-biology",
    /\b(pathogens?|anthrax|smallpox|ebola|rabies|venom(ous)?|poisonous|wild mushrooms?|mushrooms?|toadstools?|amanita|death caps?|culturing bacteria|bacteria cultures?|snake ?bites?)\b/,
  ],
];

// Only wording that is plainly about hurting someone refuses without the model; accidents
// ("I cut myself on paper"), crafts and toys are left for the model to read.
const HARM: readonly (readonly [SafetyCategory, RegExp])[] = [
  [
    "self-harm",
    /\b(kill(ing)? myself|end(ing)? my (own )?life|want to die|commit suicide|how to (die|suicide)|suicide (method|methods|ways)|((want|going|trying|planning) to|how (can|do|could|should) i|ways to) (hurt|harm|cut|poison|starve) (myself|my ?self))\b/,
  ],
  [
    "weapons",
    new RegExp(
      `\\b(make|build|assemble|construct|3d[- ]?print|craft)\\b.{0,40}${NOT_A_WEAPON}\\b(bombs?|explosives?|guns?|firearms?|grenades?|napalm|pipe bombs?|molotov|silencers?)\\b`,
    ),
  ],
  [
    "chemical-exposure",
    /\b(make|produce|create|release)\b.{0,30}\b(toxic|poison(ous)?|nerve|chlorine|mustard) gas\b/,
  ],
  [
    "medical",
    /\b(poison|drug|sedate|overdose) (someone|somebody|a person|people|him|her|them|my (mum|mom|dad|brother|sister|friend|teacher|boss|wife|husband))\b/,
  ],
  [
    "dangerous-biology",
    /\b(grow|culture|spread|weaponi[sz]e|release)\b.{0,30}\b(anthrax|smallpox|ebola|pathogens?|bioweapons?|plague)\b/,
  ],
];

export interface RuleMatch {
  categories: SafetyCategory[];
  /** The category whose harm pattern matched, when the text seeks to hurt someone. */
  harm?: SafetyCategory;
}

/** Categories named outright in the text, and whether it plainly asks how to hurt someone. */
export function matchRules(text: string): RuleMatch {
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  const harm = HARM.find(([, pattern]) => pattern.test(lower))?.[0];
  const categories = TOPICS.filter(([, pattern]) => pattern.test(lower)).map(([name]) => name);
  if (harm && !categories.includes(harm)) categories.push(harm);
  return harm ? { categories, harm } : { categories };
}
