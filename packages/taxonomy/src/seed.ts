import type { TaxonomyEntryInput } from "./schema";

const category = (
  id: string,
  label: string,
  domain: TaxonomyEntryInput["domain"],
  concepts: string[] = [],
): TaxonomyEntryInput => ({ id: `category.${id}`, kind: "category", label, domain, concepts });

const object = (
  id: string,
  label: string,
  parent: string,
  extra: Partial<TaxonomyEntryInput> = {},
): TaxonomyEntryInput => ({
  id: `object.${id}`,
  kind: "object",
  label,
  parentId: `category.${parent}`,
  ...extra,
});

// Covers seed set 2.0.0 and the objects the text search offered before this service existed.
export const SEED_TAXONOMY: readonly TaxonomyEntryInput[] = [
  category("mechanisms", "Machines and mechanisms", "physics", ["force", "energy transfer"]),
  category("heating", "Heating and cooking", "physics", ["heat transfer", "temperature"]),
  category("optics", "Light and lenses", "physics", ["reflection", "refraction"]),
  category("electricity", "Electricity", "physics", ["electric current", "circuits"]),
  category("magnetism", "Magnets", "physics", ["magnetic field"]),
  category("motion", "Motion and forces", "physics", ["gravity", "friction"]),
  category("nature-patterns", "Patterns in nature", "maths", ["symmetry", "spirals"]),
  category("shapes", "Shapes and solids", "maths", ["polygons", "tessellation"]),
  category("chance", "Chance and probability", "maths", ["probability"]),
  category("plants", "Plants", "biology", ["photosynthesis"]),
  category("fungi", "Fungi", "biology", ["decomposition"]),
  category("animals", "Animals", "biology", ["adaptation"]),
  category("food", "Food", "biology", ["ripening"]),
  category("human-body", "The human body", "biology", ["circulation"]),
  category("reactions", "Everyday reactions", "chemistry", ["oxidation"]),
  category("states-of-matter", "Solids, liquids and gases", "chemistry", ["density"]),
  category("crystals", "Crystals", "chemistry", ["crystal structure"]),
  category("mixtures", "Mixtures and solutions", "chemistry", ["surface tension"]),
  category("household-chemicals", "Household chemicals and medicines", "chemistry"),
  category("instruments", "Musical instruments", "arts", ["vibration", "pitch"]),
  category("colour", "Colour and art", "arts", ["colour mixing"]),
  category("ceramics", "Ceramics", "arts", ["firing"]),

  object("bicycle", "Bicycle", "mechanisms", {
    aliases: ["bike", "road bike", "mountain bike", "cycle"],
    keywords: ["pedal", "ride", "wheel"],
    parts: [
      { id: "object.bicycle:chain", label: "Chain" },
      { id: "object.bicycle:gears", label: "Gears", aliases: ["cog", "sprocket", "cassette"] },
      { id: "object.bicycle:brakes", label: "Brakes", aliases: ["brake"] },
      { id: "object.bicycle:pedals", label: "Pedals", aliases: ["pedal", "crank"] },
    ],
    concepts: ["gear ratio", "mechanical advantage"],
    facts: [
      {
        scope: "category",
        text: "The chain carries the turning force from the pedals to the back wheel.",
      },
      {
        scope: "category",
        text: "A low gear turns the back wheel less per pedal turn, so each push needs less force.",
      },
      {
        scope: "object-specific",
        text: "Some bicycles have gears hidden inside the back hub instead of a visible cassette.",
      },
      { scope: "object-specific", text: "Some bicycles have only one gear." },
    ],
  }),
  object("electric-kettle", "Electric kettle", "heating", {
    aliases: ["kettle", "water boiler"],
    keywords: ["boil", "tea", "water"],
    parts: [
      { id: "object.electric-kettle:element", label: "Heating element", aliases: ["element"] },
      { id: "object.electric-kettle:switch", label: "Switch", aliases: ["thermostat"] },
    ],
    concepts: ["boiling", "convection", "electrical heating"],
    facts: [
      {
        scope: "category",
        text: "An electric current through the heating element turns electrical energy into heat.",
      },
      { scope: "category", text: "The bubbles in boiling water are water vapour, not air." },
      {
        scope: "object-specific",
        text: "Some kettles let you choose a temperature below boiling.",
      },
      { scope: "object-specific", text: "Some kettles hide the element under a flat metal base." },
    ],
  }),
  object("teapot", "Teapot", "heating", {
    keywords: ["brew", "pot", "tea"],
    concepts: ["insulation"],
  }),
  object("coffee-pot", "Coffee pot", "heating", {
    aliases: ["cafetiere", "french press"],
    keywords: ["brew", "coffee"],
    concepts: ["dissolving"],
  }),
  object("toaster", "Toaster", "heating", {
    keywords: ["bread", "toast"],
    concepts: ["browning", "electrical heating"],
  }),
  object("magnifying-glass", "Magnifying glass", "optics", {
    aliases: ["magnifier", "hand lens", "convex lens"],
    keywords: ["zoom", "bigger"],
    parts: [{ id: "object.magnifying-glass:lens", label: "Lens" }],
    concepts: ["focal length"],
    facts: [
      {
        scope: "category",
        text: "A magnifying glass is a convex lens: thicker in the middle than at the edge.",
      },
      {
        scope: "category",
        text: "Light bends as it passes through the lens, so a close object looks bigger.",
      },
      {
        scope: "object-specific",
        text: "How much it magnifies depends on how strongly its lens curves.",
      },
    ],
  }),
  object("mirror", "Mirror", "optics", { keywords: ["reflection"] }),
  object("eyeglasses", "Eyeglasses", "optics", {
    aliases: ["glasses", "spectacles"],
    keywords: ["lens", "sight"],
    parts: [{ id: "object.eyeglasses:lenses", label: "Lenses", aliases: ["lens"] }],
    concepts: ["focal length"],
  }),
  object("light-bulb", "Light bulb", "electricity", {
    aliases: ["bulb", "lightbulb"],
    keywords: ["lamp", "light"],
    concepts: ["resistance"],
  }),
  object("electrical-socket", "Electrical socket", "electricity", {
    aliases: ["power outlet", "wall socket", "plug socket", "electrical outlet"],
  }),
  object("magnetic-compass", "Magnetic compass", "magnetism", {
    aliases: ["compass"],
    keywords: ["north", "needle"],
    parts: [{ id: "object.magnetic-compass:needle", label: "Needle" }],
    concepts: ["Earth's magnetic field"],
    facts: [
      {
        scope: "category",
        text: "The needle is a small magnet that lines up with Earth's magnetic field.",
      },
      {
        scope: "object-specific",
        text: "Some compasses are filled with liquid to steady the needle.",
      },
    ],
  }),
  object("magnet", "Magnet", "magnetism", { keywords: ["fridge", "magnetic"] }),
  object("swing", "Playground swing", "motion", {
    aliases: ["swing", "swing set"],
    concepts: ["pendulum"],
  }),
  object("feather", "Feather", "motion", {
    aliases: ["bird feather"],
    concepts: ["air resistance"],
  }),
  object("umbrella", "Umbrella", "motion", { keywords: ["rain"], concepts: ["waterproofing"] }),
  object("honeycomb", "Honeycomb", "nature-patterns", {
    aliases: ["beeswax comb", "honey comb"],
    concepts: ["hexagons", "tessellation"],
  }),
  object("sunflower", "Sunflower", "nature-patterns", {
    aliases: ["sunflower head", "helianthus"],
    concepts: ["Fibonacci numbers"],
  }),
  object("pine-cone", "Pine cone", "nature-patterns", {
    aliases: ["pinecone", "conifer cone"],
    concepts: ["Fibonacci numbers"],
  }),
  object("snowflake", "Snowflake", "nature-patterns", {
    aliases: ["snow crystal", "ice crystal"],
    concepts: ["hexagonal symmetry"],
  }),
  object("nautilus-shell", "Nautilus shell", "nature-patterns", {
    aliases: ["nautilus", "seashell", "shell"],
    concepts: ["logarithmic spiral"],
  }),
  object("football", "Football", "shapes", {
    aliases: ["soccer ball"],
    keywords: ["ball"],
    concepts: ["truncated icosahedron"],
  }),
  object("dice", "Dice", "chance", { aliases: ["die", "six-sided die"] }),
  object("leaf", "Leaf", "plants", {
    aliases: ["tree leaf", "green leaf", "plant leaf"],
    parts: [
      { id: "object.leaf:veins", label: "Veins", aliases: ["vein"] },
      { id: "object.leaf:stalk", label: "Stalk", aliases: ["petiole", "stem"] },
    ],
    concepts: ["chlorophyll"],
    facts: [
      {
        scope: "category",
        text: "Leaves use sunlight to make sugar from carbon dioxide and water.",
      },
      {
        scope: "category",
        text: "Most of a plant's dry mass comes from carbon dioxide in the air, not from soil.",
      },
      {
        scope: "object-specific",
        text: "Some leaves are red or purple because other pigments hide the green chlorophyll.",
      },
    ],
  }),
  object("cactus", "Cactus", "plants", {
    aliases: ["cacti", "succulent"],
    concepts: ["water storage"],
  }),
  object("mushroom", "Mushroom", "fungi", { aliases: ["fungus", "toadstool"] }),
  object("honey-bee", "Honey bee", "animals", {
    aliases: ["bee", "honeybee"],
    concepts: ["navigation"],
  }),
  object("banana", "Banana", "food", { aliases: ["bananas"], concepts: ["ethylene"] }),
  object("veins-wrist", "Veins on a wrist", "human-body", { aliases: ["veins", "wrist"] }),
  object("rusty-nail", "Rusty nail", "reactions", {
    aliases: ["rust", "nail", "corroded iron"],
    concepts: ["corrosion"],
    facts: [
      { scope: "category", text: "Rust forms when iron reacts with oxygen and water." },
      {
        scope: "object-specific",
        text: "Galvanised nails have a zinc coating that slows rusting.",
      },
    ],
  }),
  object("candle", "Candle", "reactions", {
    aliases: ["candle flame", "wax candle"],
    parts: [
      { id: "object.candle:wick", label: "Wick" },
      { id: "object.candle:flame", label: "Flame" },
    ],
    concepts: ["combustion"],
  }),
  object("cut-apple", "Cut apple", "reactions", {
    aliases: ["apple", "apple slice"],
    concepts: ["enzymatic browning"],
  }),
  object("ice-cubes", "Ice cubes", "states-of-matter", {
    aliases: ["ice", "ice cube"],
    concepts: ["melting"],
    facts: [
      {
        scope: "category",
        text: "Ice floats because water expands as it freezes, so ice is less dense.",
      },
      {
        scope: "object-specific",
        text: "Cloudy ice has tiny trapped air bubbles; clear ice has fewer.",
      },
    ],
  }),
  object("glass-of-water", "Glass of water", "states-of-matter", {
    aliases: ["drinking glass", "glass", "water"],
  }),
  object("salt-crystals", "Salt crystals", "crystals", {
    aliases: ["salt", "sea salt", "sodium chloride"],
  }),
  object("soap-bubble", "Soap bubble", "mixtures", {
    aliases: ["bubble", "bubbles"],
    concepts: ["thin-film interference"],
  }),
  object("cleaning-products", "Cleaning products", "household-chemicals", {
    aliases: ["bleach", "household cleaner", "cleaning bottles"],
  }),
  object("medicine-tablets", "Medicine tablets", "household-chemicals", {
    aliases: ["pills", "tablets", "medication"],
  }),
  object("acoustic-guitar", "Acoustic guitar", "instruments", {
    aliases: ["guitar", "classical guitar"],
    parts: [
      { id: "object.acoustic-guitar:strings", label: "Strings", aliases: ["string"] },
      { id: "object.acoustic-guitar:sound-hole", label: "Sound hole" },
      { id: "object.acoustic-guitar:frets", label: "Frets", aliases: ["fret"] },
    ],
    concepts: ["frequency", "resonance"],
    facts: [
      {
        scope: "category",
        text: "A shorter, tighter or thinner string vibrates faster and sounds higher.",
      },
      {
        scope: "object-specific",
        text: "Classical guitars use nylon strings; many others use steel.",
      },
    ],
  }),
  object("drum", "Drum", "instruments", { aliases: ["snare drum", "drum kit"] }),
  object("stained-glass", "Stained glass window", "colour", {
    aliases: ["stained glass", "church window"],
  }),
  object("paint-palette", "Paint palette", "colour", {
    aliases: ["palette", "paints", "watercolours"],
    concepts: ["subtractive mixing"],
  }),
  object("abstract-painting", "Abstract painting", "colour", {
    aliases: ["painting", "artwork", "canvas"],
  }),
  object("clay-pot", "Clay pot", "ceramics", { aliases: ["pottery", "ceramic pot", "vase"] }),
];
