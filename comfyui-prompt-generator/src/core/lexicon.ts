import type { Category } from "./types";

/**
 * A single keyword->tag rule. The pattern is matched against the normalized
 * (lowercased) input text as a whole-word match. When `tag` is omitted the
 * matched keyword itself is emitted.
 */
export interface Rule {
  pattern: RegExp;
  tag: string;
  category: Category;
}

/**
 * Build a word-boundary regex for a phrase. Spaces are allowed to match one or
 * more whitespace characters so "golden hour" matches "golden   hour" too.
 */
function wordRegex(phrase: string): RegExp {
  const escaped = phrase
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, "i");
}

/**
 * Turn a category's keyword map into Rules. Keys are matched in the input;
 * values are the canonical tag emitted. Use the same string for both when the
 * keyword is already the canonical tag.
 */
function rules(category: Category, map: Record<string, string>): Rule[] {
  return Object.entries(map).map(([keyword, tag]) => ({
    pattern: wordRegex(keyword),
    tag,
    category,
  }));
}

// ---------------------------------------------------------------------------
// Keyword maps per category. Keys = phrase to look for, values = emitted tag.
// Longer / more specific phrases should be listed; the parser sorts by length
// so specific phrases win over generic ones.
// ---------------------------------------------------------------------------

const subject = rules("subject", {
  "young woman": "young woman",
  "old woman": "old woman",
  "elderly woman": "elderly woman",
  woman: "woman",
  "young man": "young man",
  "old man": "old man",
  "elderly man": "elderly man",
  man: "man",
  girl: "girl",
  boy: "boy",
  child: "child",
  baby: "baby",
  person: "person",
  warrior: "warrior",
  knight: "knight",
  wizard: "wizard",
  witch: "witch",
  robot: "robot",
  android: "android",
  cyborg: "cyborg",
  dragon: "dragon",
  cat: "cat",
  dog: "dog",
  wolf: "wolf",
  horse: "horse",
  bird: "bird",
  angel: "angel",
  demon: "demon",
  elf: "elf",
  mermaid: "mermaid",
  samurai: "samurai",
  ninja: "ninja",
  astronaut: "astronaut",
  soldier: "soldier",
  king: "king",
  queen: "queen",
  princess: "princess",
});

const appearance = rules("appearance", {
  // hair style (length & color handled separately as composites)
  ponytail: "ponytail",
  twintails: "twintails",
  pigtails: "twintails",
  braid: "braided hair",
  braided: "braided hair",
  bun: "hair bun",
  bob: "bob cut",
  bangs: "bangs",
  fringe: "bangs",
  curly: "curly hair",
  wavy: "wavy hair",
  straight: "straight hair",
  bald: "bald",
  freckles: "freckles",
  // body / build
  muscular: "muscular",
  slim: "slim",
  slender: "slender",
  athletic: "athletic build",
  tall: "tall",
  petite: "petite",
  chubby: "chubby",
  // skin
  "pale skin": "pale skin",
  "dark skin": "dark skin",
  "tan skin": "tanned skin",
  tanned: "tanned skin",
  // facial hair
  beard: "beard",
  mustache: "mustache",
  goatee: "goatee",
  stubble: "stubble",
  // accessories that read as appearance
  glasses: "glasses",
  sunglasses: "sunglasses",
  earrings: "earrings",
  tattoo: "tattoo",
  tattoos: "tattoos",
  scar: "scar",
  // age / skin detail (common in Qwen portrait prompts)
  wrinkles: "wrinkles",
  "age spots": "age spots",
  "laugh lines": "laugh lines",
  "smile lines": "laugh lines",
  "weathered skin": "weathered skin",
  // misc
  wings: "wings",
  horns: "horns",
});

const clothing = rules("clothing", {
  "leather jacket": "leather jacket",
  jacket: "jacket",
  coat: "coat",
  hoodie: "hoodie",
  "t-shirt": "t-shirt",
  shirt: "shirt",
  crewneck: "crewneck shirt",
  sweater: "sweater",
  blazer: "blazer",
  apron: "apron",
  blouse: "blouse",
  dress: "dress",
  gown: "gown",
  skirt: "skirt",
  jeans: "jeans",
  pants: "pants",
  trousers: "pants",
  shorts: "shorts",
  suit: "suit",
  tuxedo: "tuxedo",
  kimono: "kimono",
  armor: "armor",
  cloak: "cloak",
  cape: "cape",
  robe: "robe",
  uniform: "uniform",
  bikini: "bikini",
  swimsuit: "swimsuit",
  hat: "hat",
  cap: "cap",
  helmet: "helmet",
  crown: "crown",
  scarf: "scarf",
  gloves: "gloves",
  boots: "boots",
  "high heels": "high heels",
  mask: "mask",
});

const expression = rules("expression", {
  smiling: "smiling",
  smile: "smiling",
  grinning: "grin",
  laughing: "laughing",
  crying: "crying",
  angry: "angry",
  furious: "angry",
  sad: "sad",
  serious: "serious expression",
  surprised: "surprised",
  scared: "scared",
  afraid: "scared",
  confident: "confident",
  blushing: "blush",
  winking: "wink",
  frowning: "frown",
});

const pose = rules("pose", {
  standing: "standing",
  sitting: "sitting",
  seated: "sitting",
  lying: "lying down",
  kneeling: "kneeling",
  crouching: "crouching",
  running: "running",
  walking: "walking",
  jumping: "jumping",
  dancing: "dancing",
  flying: "flying",
  fighting: "fighting",
  leaning: "leaning",
  "arms crossed": "crossed arms",
  "hands on hips": "hands on hips",
  "looking back": "looking back",
  "looking at viewer": "looking at viewer",
  "looking away": "looking away",
});

const composition = rules("composition", {
  "close-up": "close-up",
  closeup: "close-up",
  "extreme close-up": "extreme close-up",
  portrait: "portrait",
  "full body": "full body",
  "full-body": "full body",
  "upper body": "upper body",
  "wide shot": "wide shot",
  "wide angle": "wide angle",
  "from above": "from above",
  "high angle": "from above",
  "from below": "from below",
  "low angle": "from below",
  "bird's eye view": "from above",
  "dutch angle": "dutch angle",
  "depth of field": "depth of field",
  "shallow depth of field": "depth of field",
  bokeh: "bokeh",
  "rule of thirds": "rule of thirds",
  symmetrical: "symmetrical composition",
  silhouette: "silhouette",
});

const setting = rules("setting", {
  forest: "forest",
  jungle: "jungle",
  desert: "desert",
  mountain: "mountains",
  mountains: "mountains",
  beach: "beach",
  ocean: "ocean",
  sea: "ocean",
  lake: "lake",
  river: "river",
  waterfall: "waterfall",
  city: "city",
  cityscape: "cityscape",
  street: "city street",
  alley: "alleyway",
  village: "village",
  castle: "castle",
  temple: "temple",
  church: "church",
  ruins: "ruins",
  cave: "cave",
  field: "field",
  meadow: "meadow",
  garden: "garden",
  park: "park",
  bedroom: "bedroom",
  kitchen: "kitchen",
  "living room": "living room",
  office: "office",
  studio: "studio",
  playground: "playground",
  home: "home interior",
  cafe: "cafe",
  bar: "bar",
  library: "library",
  laboratory: "laboratory",
  spaceship: "spaceship",
  "space station": "space station",
  underwater: "underwater",
  indoors: "indoors",
  outdoors: "outdoors",
  rooftop: "rooftop",
  bridge: "bridge",
  "white background": "white background",
  "black background": "black background",
  "simple background": "simple background",
  "gradient background": "gradient background",
  "blurred background": "blurred background",
  "blurry background": "blurred background",
  cyberpunk: "cyberpunk city",
  futuristic: "futuristic",
  "post-apocalyptic": "post-apocalyptic",
  battlefield: "battlefield",
});

const timeWeather = rules("timeWeather", {
  night: "night",
  nighttime: "night",
  midnight: "night",
  day: "daytime",
  daytime: "daytime",
  noon: "daytime",
  morning: "morning",
  dawn: "dawn",
  dusk: "dusk",
  twilight: "twilight",
  sunset: "sunset",
  sunrise: "sunrise",
  rain: "rain",
  rainy: "rain",
  raining: "rain",
  snow: "snow",
  snowy: "snow",
  snowing: "snow",
  fog: "fog",
  foggy: "fog",
  mist: "mist",
  misty: "mist",
  storm: "storm",
  stormy: "storm",
  cloudy: "cloudy sky",
  "clear sky": "clear sky",
  windy: "wind",
  autumn: "autumn",
  fall: "autumn",
  winter: "winter",
  spring: "spring",
  summer: "summer",
});

const lighting = rules("lighting", {
  "cinematic lighting": "cinematic lighting",
  cinematic: "cinematic lighting",
  "rim light": "rim lighting",
  "rim lighting": "rim lighting",
  backlight: "backlighting",
  backlit: "backlighting",
  "golden hour": "golden hour",
  "soft light": "soft lighting",
  "soft lighting": "soft lighting",
  "natural light": "natural lighting",
  "natural lighting": "natural lighting",
  "natural daylight": "natural lighting",
  "side lighting": "side lighting",
  "side light": "side lighting",
  "diffused light": "diffused lighting",
  "hard light": "hard lighting",
  "studio lighting": "studio lighting",
  "volumetric lighting": "volumetric lighting",
  "god rays": "volumetric lighting",
  "neon lights": "neon lights",
  neon: "neon lights",
  "candle light": "candlelight",
  candlelight: "candlelight",
  moonlight: "moonlight",
  sunlight: "sunlight",
  "harsh shadows": "dramatic shadows",
  "dramatic lighting": "dramatic lighting",
  "low key": "low-key lighting",
  "high key": "high-key lighting",
  glowing: "glowing",
  bioluminescent: "bioluminescence",
});

const mood = rules("mood", {
  moody: "moody atmosphere",
  serene: "serene",
  peaceful: "peaceful",
  calm: "calm",
  tense: "tense",
  ominous: "ominous",
  eerie: "eerie",
  creepy: "creepy",
  dreamy: "dreamy",
  ethereal: "ethereal",
  melancholic: "melancholic",
  melancholy: "melancholic",
  romantic: "romantic",
  epic: "epic",
  whimsical: "whimsical",
  mysterious: "mysterious",
  nostalgic: "nostalgic",
  gloomy: "gloomy",
  cheerful: "cheerful",
  cozy: "cozy",
});

const style = rules("style", {
  photorealistic: "photorealistic",
  photoreal: "photorealistic",
  realistic: "realistic",
  photograph: "photograph",
  photo: "photograph",
  "oil painting": "oil painting",
  watercolor: "watercolor",
  "watercolor painting": "watercolor painting",
  "pencil sketch": "pencil sketch",
  sketch: "sketch",
  "charcoal drawing": "charcoal drawing",
  illustration: "illustration",
  "digital art": "digital art",
  "digital painting": "digital painting",
  "concept art": "concept art",
  anime: "anime",
  manga: "manga",
  cartoon: "cartoon",
  "comic book": "comic book style",
  "pixel art": "pixel art",
  "3d render": "3d render",
  render: "3d render",
  "low poly": "low poly",
  cyberpunk: "cyberpunk",
  steampunk: "steampunk",
  "art nouveau": "art nouveau",
  "art deco": "art deco",
  impressionist: "impressionism",
  surreal: "surrealism",
  surrealism: "surrealism",
  minimalist: "minimalist",
  baroque: "baroque",
  gothic: "gothic",
  vaporwave: "vaporwave",
  "fantasy art": "fantasy art",
  "sci-fi": "sci-fi",
  "ukiyo-e": "ukiyo-e",
});

const color = rules("color", {
  "vibrant colors": "vibrant colors",
  vibrant: "vibrant colors",
  colorful: "colorful",
  monochrome: "monochrome",
  "black and white": "monochrome",
  grayscale: "monochrome",
  sepia: "sepia",
  "pastel colors": "pastel colors",
  pastel: "pastel colors",
  "muted colors": "muted colors",
  "high contrast": "high contrast",
  "warm tones": "warm color palette",
  "cool tones": "cool color palette",
  "neon colors": "neon color palette",
});

/** All rules concatenated, sorted longest-keyword-first so specific wins. */
export const LEXICON: Rule[] = [
  ...subject,
  ...appearance,
  ...clothing,
  ...expression,
  ...pose,
  ...composition,
  ...setting,
  ...timeWeather,
  ...lighting,
  ...mood,
  ...style,
  ...color,
].sort((a, b) => b.pattern.source.length - a.pattern.source.length);

/** Hair color words used by the composite hair extractor. */
export const HAIR_COLORS = [
  "blonde",
  "blond",
  "brunette",
  "brown",
  "black",
  "red",
  "ginger",
  "auburn",
  "white",
  "grey",
  "gray",
  "silver",
  "pink",
  "blue",
  "green",
  "purple",
  "orange",
];

/** Hair length words used by the composite hair extractor. */
export const HAIR_LENGTHS = ["very long", "long", "shoulder-length", "medium", "short"];

/** Eye color words used by the composite eye extractor. */
export const EYE_COLORS = [
  "blue",
  "green",
  "brown",
  "hazel",
  "amber",
  "golden",
  "gold",
  "red",
  "grey",
  "gray",
  "violet",
  "purple",
  "black",
  "heterochromia",
];

/** Words that signal a plural / multiple subjects. */
export const PLURAL_SUBJECTS: Record<string, "girls" | "boys" | "people"> = {
  women: "girls",
  girls: "girls",
  ladies: "girls",
  men: "boys",
  boys: "boys",
  guys: "boys",
  people: "people",
  crowd: "people",
  group: "people",
};

/** Filler phrases stripped when producing natural-language output. */
export const NATURAL_FILLER: RegExp[] = [
  /\b(the\s+)?(image|picture|photo|photograph|artwork|painting|drawing|scene)\s+(shows|depicts|features|has|is of|portrays)\b/gi,
  /\b(there\s+is|there\s+are|we\s+(can\s+)?see|you\s+(can\s+)?see)\b/gi,
  /\b(an?\s+)?(image|picture|photo|render|illustration)\s+of\b/gi,
  /\bi\s+want\b/gi,
  /\bgenerate\b/gi,
  /\bcreate\b/gi,
];
