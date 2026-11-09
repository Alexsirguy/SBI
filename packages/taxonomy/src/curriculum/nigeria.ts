import type { CurriculumInfo, Standard, SubjectInfo } from "./schema";

export const NIGERIA_INFO: CurriculumInfo = {
  id: "ng",
  label: "Nigeria",
  levels: ["P4-6", "JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"],
  frameworks: [
    {
      id: "nerdc-bst",
      name: "NERDC 9-Year Basic Education Curriculum: Basic Science and Technology",
      source: "https://nerdc.gov.ng",
    },
    {
      id: "nerdc-mth",
      name: "NERDC 9-Year Basic Education Curriculum: Mathematics",
      source: "https://nerdc.gov.ng",
    },
    {
      id: "nerdc-sss",
      name: "NERDC Senior Secondary School Curriculum: Mathematics, Physics, Chemistry, Biology",
      source: "https://nerdc.gov.ng",
    },
  ],
};

const SSS = ["SSS1", "SSS2", "SSS3"];
const JSS = ["JSS1", "JSS2", "JSS3"];

export const NIGERIA_SUBJECTS: readonly SubjectInfo[] = [
  {
    id: "ng-basic-science",
    curriculum: "ng",
    framework: "nerdc-bst",
    name: "Basic Science and Technology",
    levels: ["P4-6", ...JSS],
  },
  {
    id: "ng-jss-maths",
    curriculum: "ng",
    framework: "nerdc-mth",
    name: "Mathematics",
    levels: JSS,
  },
  {
    id: "ng-sss-maths",
    curriculum: "ng",
    framework: "nerdc-sss",
    name: "Mathematics",
    levels: SSS,
  },
  { id: "ng-physics", curriculum: "ng", framework: "nerdc-sss", name: "Physics", levels: SSS },
  { id: "ng-chemistry", curriculum: "ng", framework: "nerdc-sss", name: "Chemistry", levels: SSS },
  { id: "ng-biology", curriculum: "ng", framework: "nerdc-sss", name: "Biology", levels: SSS },
];

type Discipline = "science" | "maths" | "physics" | "chemistry" | "biology";

const SUBJECT_CODE: Record<Discipline, string> = {
  science: "BST",
  maths: "MTH",
  physics: "PHY",
  chemistry: "CHM",
  biology: "BIO",
};

const subjectFor = (discipline: Discipline, level: string) =>
  discipline === "science"
    ? "ng-basic-science"
    : discipline === "maths"
      ? level.startsWith("SSS")
        ? "ng-sss-maths"
        : "ng-jss-maths"
      : `ng-${discipline}`;

const themeName = (theme: string) =>
  theme.charAt(0) + theme.slice(1).toLowerCase().replace(/-/g, " ");

// NERDC topics have no official codes, so codes are ours: NG-<subject>-<class>-<theme>-<topic>.
function topic(
  level: string,
  subject: Discipline,
  theme: string,
  name: string,
  title: string,
  concepts: string[],
): Standard {
  const sss = level.startsWith("SSS");
  return {
    curriculum: "ng",
    framework: sss ? "nerdc-sss" : subject === "maths" ? "nerdc-mth" : "nerdc-bst",
    code: ["NG", SUBJECT_CODE[subject], level, theme, name].join("-"),
    level,
    subject: subjectFor(subject, level),
    theme: themeName(theme),
    title,
    concepts,
  };
}

const bst = (level: string, theme: string, name: string, title: string, concepts: string[]) =>
  topic(level, "science", theme, name, title, concepts);

// Class placement follows the usual scheme of work; schools reorder topics, so treat it as a guide.
export const NIGERIA_STANDARDS: readonly Standard[] = [
  bst("P4-6", "ENERGY", "SIMPLE-MACHINES", "Simple machines: levers, pulleys, wheels and gears", [
    "mechanical-advantage",
    "gear-ratio",
    "force",
  ]),
  bst("P4-6", "ENERGY", "MAGNETS", "Magnets and their uses", [
    "magnetic-field",
    "earth-s-magnetic-field",
  ]),
  bst("P4-6", "ENERGY", "LIGHT", "Light and shadows; mirrors", ["reflection"]),
  bst("P4-6", "ENERGY", "SOUND", "Sound: how it is made and heard", ["vibration", "pitch"]),
  bst("P4-6", "MATTER", "STATES", "Solids, liquids and gases; melting and boiling", [
    "melting",
    "boiling",
  ]),
  bst("P4-6", "LIVING", "PLANTS", "Plants make food using sunlight", [
    "photosynthesis",
    "chlorophyll",
  ]),
  bst("JSS1", "ENERGY", "HEAT", "Heat energy: conduction, convection and radiation", [
    "heat-transfer",
    "conduction",
    "convection",
    "insulation",
    "temperature",
  ]),
  bst("JSS1", "MATTER", "PROPERTIES", "Matter and its properties", [
    "properties-of-materials",
    "density",
    "waterproofing",
  ]),
  bst("JSS1", "LIVING", "HABITATS", "Living things and their habitats", [
    "adaptation",
    "water-storage",
  ]),
  bst("JSS2", "ENERGY", "WORK-ENERGY", "Work, energy and power; kinetic and potential energy", [
    "energy-transfer",
    "pendulum",
  ]),
  bst("JSS2", "ENERGY", "ELECTRICITY", "Electricity: current, simple circuits and cells", [
    "electric-current",
    "circuits",
    "batteries",
    "electrical-heating",
  ]),
  bst("JSS2", "ENERGY", "MAGNETISM", "Magnetism and the compass", [
    "magnetic-field",
    "earth-s-magnetic-field",
  ]),
  bst("JSS2", "MATTER", "MIXTURES", "Mixtures, solutions and separation", [
    "dissolving",
    "surface-tension",
  ]),
  bst("JSS3", "ENERGY", "LIGHT", "Light: reflection, refraction and lenses", [
    "reflection",
    "refraction",
    "focal-length",
    "colour-mixing",
  ]),
  bst("JSS3", "ENERGY", "SOUND", "Sound waves and musical instruments", [
    "vibration",
    "frequency",
    "pitch",
    "resonance",
  ]),
  bst("JSS3", "MATTER", "CHANGES", "Physical and chemical changes; rusting and burning", [
    "corrosion",
    "combustion",
    "oxidation",
    "browning",
  ]),
  bst("JSS3", "LIVING", "ECOSYSTEM", "Food chains, decomposers and the ecosystem", [
    "decomposition",
  ]),
  bst("JSS3", "LIVING", "BODY", "Body systems: the blood and circulation", ["circulation"]),

  topic("SSS1", "physics", "MOTION", "FRICTION", "Motion, forces and friction", [
    "force",
    "friction",
    "air-resistance",
  ]),
  topic("SSS1", "physics", "MATTER", "DENSITY", "Density and upthrust", ["density"]),
  topic("SSS1", "physics", "MATTER", "PRESSURE", "Pressure in solids and fluids", ["pressure"]),
  topic(
    "SSS1",
    "physics",
    "HEAT",
    "TEMPERATURE",
    "Temperature and its measurement; thermal expansion",
    ["temperature"],
  ),
  topic("SSS1", "physics", "ENERGY", "WORK-ENERGY-POWER", "Work, energy and power", [
    "energy-transfer",
  ]),
  topic("SSS1", "physics", "MOTION", "SHM", "Simple harmonic motion: the simple pendulum", [
    "pendulum",
    "frequency",
  ]),
  topic(
    "SSS2",
    "physics",
    "ENERGY",
    "SIMPLE-MACHINES",
    "Simple machines: mechanical advantage and efficiency",
    ["mechanical-advantage", "gear-ratio"],
  ),
  topic(
    "SSS2",
    "physics",
    "HEAT",
    "TRANSFER",
    "Heat transfer: conduction, convection and radiation",
    ["heat-transfer", "conduction", "convection", "insulation"],
  ),
  topic(
    "SSS2",
    "physics",
    "HEAT",
    "CHANGE-OF-STATE",
    "Change of state: latent heat, melting and boiling",
    ["melting", "boiling"],
  ),
  topic(
    "SSS2",
    "physics",
    "MATTER",
    "MOLECULAR",
    "Molecular properties: adhesion, cohesion, capillarity and surface tension",
    ["surface-tension"],
  ),
  topic(
    "SSS2",
    "physics",
    "WAVES",
    "LIGHT-REFLECTION",
    "Reflection of light at plane and curved mirrors",
    ["reflection"],
  ),
  topic(
    "SSS2",
    "physics",
    "WAVES",
    "LIGHT-REFRACTION",
    "Refraction of light; lenses and optical instruments",
    ["refraction", "focal-length"],
  ),
  topic("SSS2", "physics", "WAVES", "DISPERSION", "Dispersion of light and colours", [
    "colour-mixing",
    "subtractive-mixing",
    "thin-film-interference",
  ]),
  topic(
    "SSS2",
    "physics",
    "WAVES",
    "SOUND",
    "Sound waves: vibrations in strings and pipes, resonance",
    ["vibration", "frequency", "pitch", "resonance"],
  ),
  topic("SSS3", "physics", "FIELDS", "GRAVITATION", "Gravitational field", ["gravity"]),
  topic(
    "SSS3",
    "physics",
    "FIELDS",
    "CURRENT",
    "Current electricity: Ohm's law, resistance and cells",
    ["electric-current", "resistance", "circuits", "batteries"],
  ),
  topic("SSS3", "physics", "FIELDS", "HEATING-EFFECT", "Heating effect of electric current", [
    "electrical-heating",
  ]),
  topic("SSS3", "physics", "FIELDS", "MAGNETIC", "Magnetic fields, including the Earth's", [
    "magnetic-field",
    "earth-s-magnetic-field",
  ]),
  topic(
    "SSS3",
    "physics",
    "FIELDS",
    "INDUCTION",
    "Electromagnetic induction: generators and transformers",
    ["electromagnetic-induction"],
  ),

  topic(
    "SSS1",
    "chemistry",
    "MATTER",
    "KINETIC-THEORY",
    "Particulate nature of matter and kinetic theory",
    ["melting", "boiling", "density", "pressure"],
  ),
  topic("SSS1", "chemistry", "MATTER", "SOLIDS", "Crystalline and amorphous solids", [
    "crystal-structure",
    "amorphous-solids",
  ]),
  topic("SSS1", "chemistry", "MIXTURES", "SOLUBILITY", "Solutions and solubility", ["dissolving"]),
  topic("SSS2", "chemistry", "REACTIONS", "REDOX", "Oxidation and reduction", ["oxidation"]),
  topic("SSS2", "chemistry", "REACTIONS", "RATES", "Rates of chemical reactions", [
    "browning",
    "enzymatic-browning",
    "ripening",
  ]),
  topic("SSS2", "chemistry", "REACTIONS", "ENERGY", "Energy changes in reactions; combustion", [
    "combustion",
  ]),
  topic("SSS2", "chemistry", "ELECTROCHEMISTRY", "CELLS", "Electrochemical cells", ["batteries"]),
  topic("SSS3", "chemistry", "METALS", "CORROSION", "Metals and the rusting of iron", [
    "corrosion",
  ]),
  topic(
    "SSS3",
    "chemistry",
    "INDUSTRY",
    "MATERIALS",
    "Chemistry of everyday materials: ceramics, glass and plastics",
    ["properties-of-materials", "amorphous-solids", "firing", "waterproofing"],
  ),
  topic("SSS3", "chemistry", "ORGANIC", "ALKENES", "Alkenes, including ethene in fruit ripening", [
    "ethylene",
  ]),

  topic("SSS1", "biology", "PLANTS", "NUTRITION", "Nutrition in plants: photosynthesis", [
    "photosynthesis",
    "chlorophyll",
  ]),
  topic(
    "SSS1",
    "biology",
    "ECOLOGY",
    "NUTRIENT-CYCLING",
    "Ecology: decomposers and nutrient cycling",
    ["decomposition"],
  ),
  topic("SSS2", "biology", "ANIMALS", "TRANSPORT", "Transport in animals: the circulatory system", [
    "circulation",
  ]),
  topic("SSS2", "biology", "PLANTS", "TRANSPORT", "Transport and water storage in plants", [
    "water-storage",
  ]),
  topic("SSS2", "biology", "CELLS", "ENZYMES", "Enzymes and the factors that affect them", [
    "enzymatic-browning",
    "browning",
  ]),
  topic("SSS3", "biology", "PLANTS", "HORMONES", "Plant growth regulators and fruit ripening", [
    "ethylene",
    "ripening",
  ]),
  topic("SSS3", "biology", "EVOLUTION", "ADAPTATION", "Adaptation for survival and evolution", [
    "adaptation",
    "water-storage",
  ]),
  topic(
    "SSS3",
    "biology",
    "BEHAVIOUR",
    "NAVIGATION",
    "Behavioural adaptations: migration and navigation",
    ["navigation"],
  ),

  topic("SSS1", "maths", "NUMBER", "RATIO-VARIATION", "Ratio, proportion and variation", [
    "gear-ratio",
    "mechanical-advantage",
  ]),
  topic("SSS1", "maths", "GEOMETRY", "POLYGONS", "Plane shapes: angles of polygons", [
    "polygons",
    "hexagons",
  ]),
  topic("SSS1", "maths", "GEOMETRY", "MENSURATION", "Mensuration of solids", [
    "truncated-icosahedron",
  ]),
  topic(
    "SSS1",
    "maths",
    "GEOMETRY",
    "TRANSFORMATIONS",
    "Symmetry and transformations of plane shapes",
    ["symmetry", "hexagonal-symmetry", "tessellation"],
  ),
  topic("SSS1", "maths", "ALGEBRA", "LOGARITHMS", "Indices and logarithms", ["logarithmic-spiral"]),
  topic(
    "SSS2",
    "maths",
    "ALGEBRA",
    "SEQUENCES",
    "Sequences and series: arithmetic and geometric progressions",
    ["fibonacci-numbers", "spirals"],
  ),
  topic("SSS2", "maths", "TRIGONOMETRY", "GRAPHS", "Graphs of sine and cosine", [
    "pendulum",
    "frequency",
  ]),
  topic("SSS3", "maths", "STATISTICS", "PROBABILITY", "Probability", ["probability"]),
];
