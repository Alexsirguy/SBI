import type { CurriculumInfo, Standard, SubjectInfo } from "./schema";

export const US_INFO: CurriculumInfo = {
  id: "us",
  label: "United States",
  levels: ["3-5", "6-8", "9-12"],
  frameworks: [
    {
      id: "ngss",
      name: "Next Generation Science Standards",
      source: "https://www.nextgenscience.org/search-standards",
    },
    {
      id: "ccss-math",
      name: "Common Core State Standards for Mathematics",
      source: "https://www.thecorestandards.org/Math/",
    },
  ],
};

const SCIENCE_LEVELS = ["3-5", "6-8", "9-12"];
const science = (id: string, name: string): SubjectInfo => ({
  id,
  curriculum: "us",
  framework: "ngss",
  name,
  levels: SCIENCE_LEVELS,
});

export const US_SUBJECTS: readonly SubjectInfo[] = [
  science("us-physical-science", "Physical Science"),
  science("us-life-science", "Life Science"),
  science("us-earth-space-science", "Earth and Space Science"),
  science("us-engineering", "Engineering Design"),
  // Grades 3–5 hold two early entries; the supported range is grades 6–8 and high school.
  {
    id: "us-maths",
    curriculum: "us",
    framework: "ccss-math",
    name: "Mathematics",
    levels: SCIENCE_LEVELS,
  },
];

const NGSS_SUBJECT: Record<string, string> = {
  PS: "us-physical-science",
  LS: "us-life-science",
  ESS: "us-earth-space-science",
  ETS: "us-engineering",
};

// The discipline sits in the code itself, e.g. MS-PS1-4 or 3-LS4-3.
const ngssSubject = (code: string) => {
  const discipline = /(?:^|-)(PS|LS|ESS|ETS)\d/.exec(code)?.[1];
  const subject = discipline && NGSS_SUBJECT[discipline];
  if (!subject) throw new Error(`No NGSS discipline in ${code}`);
  return subject;
};

const ngss = (code: string, level: string, title: string, concepts: string[]): Standard => ({
  curriculum: "us",
  framework: "ngss",
  code,
  level,
  subject: ngssSubject(code),
  title,
  concepts,
});

const ccss = (code: string, level: string, title: string, concepts: string[]): Standard => ({
  curriculum: "us",
  framework: "ccss-math",
  code,
  level,
  subject: "us-maths",
  title,
  concepts,
});

// Concept keys are our reading of each performance expectation, not an official NGSS mapping.
export const US_STANDARDS: readonly Standard[] = [
  ngss("3-PS2-1", "3-5", "Balanced and unbalanced forces on the motion of an object", [
    "force",
    "friction",
  ]),
  ngss("3-PS2-3", "3-5", "Electric and magnetic interactions between objects not in contact", [
    "magnetic-field",
    "earth-s-magnetic-field",
  ]),
  ngss("4-PS3-2", "3-5", "Energy transferred by sound, light, heat and electric currents", [
    "energy-transfer",
    "heat-transfer",
    "electric-current",
    "circuits",
  ]),
  ngss("4-PS3-4", "3-5", "Design a device that converts energy from one form to another", [
    "electrical-heating",
    "batteries",
  ]),
  ngss("4-PS4-1", "3-5", "Waves have regular patterns of amplitude and wavelength", [
    "vibration",
    "frequency",
    "pitch",
  ]),
  ngss("4-PS4-2", "3-5", "Light reflecting from objects and entering the eye lets them be seen", [
    "reflection",
  ]),
  ngss("5-PS1-2", "3-5", "Weight is conserved when heating, cooling or mixing substances", [
    "melting",
    "dissolving",
  ]),
  ngss("5-PS1-3", "3-5", "Identify materials by their properties", [
    "properties-of-materials",
    "waterproofing",
    "insulation",
  ]),
  ngss("5-PS1-4", "3-5", "Mixing two or more substances can make a new substance", [
    "oxidation",
    "browning",
  ]),
  ngss("5-PS2-1", "3-5", "Earth's gravitational force pulls objects down", ["gravity"]),
  ngss(
    "5-LS1-1",
    "3-5",
    "Plants get the materials they need for growth chiefly from air and water",
    ["photosynthesis", "chlorophyll"],
  ),
  ngss("5-LS2-1", "3-5", "Matter moves among plants, animals, decomposers and the environment", [
    "decomposition",
  ]),
  ngss(
    "4-LS1-1",
    "3-5",
    "Internal and external structures support survival, growth and behaviour",
    ["adaptation", "water-storage", "circulation"],
  ),

  ngss(
    "MS-PS1-1",
    "6-8",
    "Models of the atomic composition of simple molecules and extended structures",
    ["crystal-structure", "amorphous-solids"],
  ),
  ngss(
    "MS-PS1-2",
    "6-8",
    "Properties of substances before and after they interact show whether a reaction occurred",
    ["oxidation", "combustion", "corrosion", "browning", "enzymatic-browning"],
  ),
  ngss(
    "MS-PS1-4",
    "6-8",
    "Particle motion, temperature and state change when thermal energy is added or removed",
    ["melting", "boiling", "temperature", "density"],
  ),
  ngss(
    "MS-PS1-6",
    "6-8",
    "Design a device that releases or absorbs thermal energy by chemical processes",
    ["combustion"],
  ),
  ngss(
    "MS-PS2-2",
    "6-8",
    "An object's motion depends on the sum of the forces on it and its mass",
    ["force", "friction", "air-resistance", "mechanical-advantage"],
  ),
  ngss("MS-PS2-3", "6-8", "Factors that affect the strength of electric and magnetic forces", [
    "magnetic-field",
    "electromagnetic-induction",
  ]),
  ngss(
    "MS-PS2-4",
    "6-8",
    "Gravitational interactions are attractive and depend on the masses involved",
    ["gravity"],
  ),
  ngss(
    "MS-PS2-5",
    "6-8",
    "Fields exist between objects exerting forces on each other without contact",
    ["magnetic-field", "earth-s-magnetic-field"],
  ),
  ngss("MS-PS3-3", "6-8", "Design a device that minimises or maximises thermal energy transfer", [
    "insulation",
    "conduction",
    "convection",
    "heat-transfer",
  ]),
  ngss(
    "MS-PS3-4",
    "6-8",
    "Energy transferred relates to the type and amount of matter and its temperature change",
    ["temperature", "heat-transfer", "electrical-heating"],
  ),
  ngss(
    "MS-PS3-5",
    "6-8",
    "When kinetic energy changes, energy is transferred to or from the object",
    ["energy-transfer", "pendulum"],
  ),
  ngss("MS-PS4-1", "6-8", "The amount of energy in a wave depends on its amplitude", [
    "frequency",
    "vibration",
  ]),
  ngss("MS-PS4-2", "6-8", "Waves are reflected, absorbed or transmitted through materials", [
    "reflection",
    "refraction",
    "focal-length",
    "thin-film-interference",
    "colour-mixing",
    "subtractive-mixing",
  ]),
  ngss(
    "MS-LS1-3",
    "6-8",
    "The body is a system of interacting subsystems made of groups of cells",
    ["circulation"],
  ),
  ngss("MS-LS1-5", "6-8", "Environmental and genetic factors influence the growth of organisms", [
    "ripening",
    "ethylene",
  ]),
  ngss(
    "MS-LS1-6",
    "6-8",
    "Photosynthesis cycles matter and moves energy into and out of organisms",
    ["photosynthesis", "chlorophyll"],
  ),
  ngss(
    "MS-LS2-3",
    "6-8",
    "Matter cycles and energy flows among living and non-living parts of an ecosystem",
    ["decomposition"],
  ),
  ngss(
    "MS-LS4-4",
    "6-8",
    "Genetic variation in traits increases some individuals' chance of surviving",
    ["adaptation", "water-storage"],
  ),

  ngss(
    "HS-PS1-3",
    "9-12",
    "Bulk structure relates to the strength of electrical forces between particles",
    ["surface-tension", "crystal-structure", "amorphous-solids", "dissolving"],
  ),
  ngss(
    "HS-PS1-4",
    "9-12",
    "Energy released or absorbed by a reaction depends on changes in bond energy",
    ["combustion"],
  ),
  ngss("HS-PS1-5", "9-12", "Temperature and concentration change the rate of a reaction", [
    "browning",
    "corrosion",
    "ripening",
  ]),
  ngss("HS-PS1-7", "9-12", "Atoms, and therefore mass, are conserved in a chemical reaction", [
    "oxidation",
    "combustion",
  ]),
  ngss("HS-PS2-1", "9-12", "Newton's second law: net force, mass and acceleration", [
    "force",
    "friction",
    "air-resistance",
    "mechanical-advantage",
    "gear-ratio",
  ]),
  ngss("HS-PS2-4", "9-12", "Newton's law of gravitation and Coulomb's law", ["gravity"]),
  ngss(
    "HS-PS2-5",
    "9-12",
    "An electric current makes a magnetic field, and a changing magnetic field makes a current",
    ["electromagnetic-induction", "magnetic-field", "electric-current"],
  ),
  ngss("HS-PS2-6", "9-12", "Molecular structure matters to how designed materials function", [
    "properties-of-materials",
    "waterproofing",
    "insulation",
  ]),
  ngss("HS-PS3-3", "9-12", "Design a device that converts one form of energy into another", [
    "electrical-heating",
    "batteries",
    "energy-transfer",
    "electromagnetic-induction",
  ]),
  ngss("HS-PS3-4", "9-12", "Thermal energy flows until components reach the same temperature", [
    "heat-transfer",
    "conduction",
    "convection",
    "temperature",
  ]),
  ngss(
    "HS-PS3-5",
    "9-12",
    "Forces between objects interacting through electric or magnetic fields",
    ["magnetic-field", "resistance", "circuits"],
  ),
  ngss("HS-PS4-1", "9-12", "Frequency, wavelength and speed of waves are related", [
    "frequency",
    "resonance",
    "pitch",
    "pendulum",
  ]),
  ngss("HS-PS4-3", "9-12", "Wave and particle models of electromagnetic radiation", [
    "thin-film-interference",
    "refraction",
  ]),
  ngss(
    "HS-PS4-5",
    "9-12",
    "Devices use the principles of wave behaviour to transmit and capture information",
    ["focal-length"],
  ),
  ngss("HS-LS1-2", "9-12", "Multicellular organisms are a hierarchy of interacting systems", [
    "circulation",
  ]),
  ngss("HS-LS1-5", "9-12", "Photosynthesis turns light energy into stored chemical energy", [
    "photosynthesis",
    "chlorophyll",
  ]),
  ngss(
    "HS-LS2-3",
    "9-12",
    "Cycling of matter and flow of energy in aerobic and anaerobic conditions",
    ["decomposition"],
  ),
  ngss("HS-LS4-4", "9-12", "Natural selection leads to adaptation of populations", [
    "adaptation",
    "water-storage",
  ]),

  ccss("4.G.A.3", "3-5", "Recognise lines of symmetry in two-dimensional figures", [
    "symmetry",
    "hexagonal-symmetry",
  ]),
  ccss("5.G.B.4", "3-5", "Classify two-dimensional figures in a hierarchy by their properties", [
    "polygons",
    "hexagons",
  ]),
  ccss("6.RP.A.1", "6-8", "Understand ratios and use ratio language", ["gear-ratio"]),
  ccss("7.RP.A.2", "6-8", "Recognise and represent proportional relationships", [
    "gear-ratio",
    "mechanical-advantage",
  ]),
  ccss("7.SP.C.5", "6-8", "Probability is a number between 0 and 1 expressing likelihood", [
    "probability",
  ]),
  ccss("8.G.A.1", "6-8", "Properties of rotations, reflections and translations", [
    "symmetry",
    "tessellation",
  ]),
  ccss("HSG-CO.A.3", "9-12", "Rotations and reflections that carry a regular polygon onto itself", [
    "symmetry",
    "hexagonal-symmetry",
    "hexagons",
    "polygons",
  ]),
  ccss("HSG-CO.A.5", "9-12", "Draw a figure after a rotation, reflection or translation", [
    "tessellation",
  ]),
  ccss("HSG-MG.A.1", "9-12", "Use geometric shapes and their properties to describe objects", [
    "truncated-icosahedron",
    "polygons",
  ]),
  ccss("HSF-IF.A.3", "9-12", "Sequences are functions, sometimes defined recursively", [
    "fibonacci-numbers",
  ]),
  ccss(
    "HSF-LE.A.1",
    "9-12",
    "Distinguish situations modelled by linear and exponential functions",
    ["logarithmic-spiral", "spirals"],
  ),
  ccss("HSF-TF.B.5", "9-12", "Model periodic phenomena with trigonometric functions", [
    "pendulum",
    "frequency",
  ]),
  ccss("HSS-CP.A.1", "9-12", "Describe events as subsets of a sample space", ["probability"]),
];
