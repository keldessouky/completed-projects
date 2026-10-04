// Everything that can drop from a loot box: collectibles, cosmetics, and
// Codex scrolls — cheat sheets you keep forever, so some loot also teaches.

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'celestial';
export type ItemKind = 'collectible' | 'title' | 'theme' | 'hat' | 'scroll';

export interface Item {
  id: string;
  kind: ItemKind;
  name: string;
  rarity: Rarity;
  icon: string;
  description: string;
  /** Scrolls only: the cheat sheet, in mini-markdown. */
  body?: string;
  /** Can this drop at random from boxes? (Floor scrolls only come from that floor's boss.) */
  drops?: boolean;
  /** Price in the Safe Room shop, if it's sold there. */
  price?: number;
}

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'celestial'];

const collectible = (id: string, name: string, rarity: Rarity, icon: string, description: string): Item => ({ id, kind: 'collectible', name, rarity, icon, description, drops: true });

export const COLLECTIBLES: Item[] = [
  collectible('rubber-duck', 'Rubber Duck of Listening', 'common', '🦆', 'Explain your bug to it, out loud. It says nothing. You find the bug anyway. Nobody knows how this works.'),
  collectible('cold-coffee', 'Mug of Cold Coffee', 'common', '☕', 'Brewed at the start of a "quick fix". Discovered six hours later.'),
  collectible('sticky-note', 'Sticky Note: "Works on my machine"', 'common', '📝', 'The most-quoted sentence in software history. Legally inadmissible.'),
  collectible('semicolon', 'Loose Semicolon', 'common', '⁏', 'Found rattling around the bottom of a codebase. JavaScript says you mostly don\'t need it. It disagrees.'),
  collectible('off-by-one', 'Off-by-One Ruler', 'common', '📏', 'Starts at 0. Ends one short of where you meant. Perfectly calibrated for array indexes.'),
  collectible('todo-comment', 'Ancient TODO Comment', 'common', '🗒', '"// TODO: fix this properly" — dated eleven years ago. The author has since retired.'),
  collectible('stack-overflow', 'Printed-Out Forum Answer', 'common', '📄', 'Accepted answer from 2011. Has 4,000 upvotes and is now subtly wrong.'),
  collectible('keyboard-key', 'Worn-Out Ctrl Key', 'common', '⌨', 'C and V are worn through too. Make of that what you will.'),
  collectible('null-plush', 'Null Pointer Plushie', 'uncommon', '🧸', 'Soft, cuddly, and points at absolutely nothing. Do not dereference.'),
  collectible('promise', 'Unresolved Promise', 'uncommon', '🤞', 'Still pending. Will resolve "later". Has been saying that for three years.'),
  collectible('callback-pyramid', 'Callback Pyramid (Scale Model)', 'uncommon', '🔺', 'A replica of the ancient wonder, built before async/await. Each level is nested inside the one below.'),
  collectible('merge-conflict', 'Merge Conflict in a Jar', 'uncommon', '🫙', '<<<<<<< HEAD. Keep the lid on.'),
  collectible('mechanical-keyboard', 'Very Loud Mechanical Keyboard', 'uncommon', '🎹', 'Clicky blue switches. Your coworkers know exactly how productive you are.'),
  collectible('bug-jar', 'Bug in a Jar', 'uncommon', '🐞', 'Caught alive in production. It still reproduces sometimes.'),
  collectible('tabs-spaces', 'Tabs-vs-Spaces Peace Treaty', 'uncommon', '📜', 'Unsigned. Both parties walked out over the indentation of the signature line.'),
  collectible('dark-mode', 'Bottled Dark Mode', 'uncommon', '🌑', 'One drop and every screen goes easy on the eyes. The bottle is, inexplicably, white.'),
  collectible('infinite-loop', 'Infinite Loop (Contained)', 'rare', '♾', 'Safely trapped by the station\'s loop guard. Still spinning. You can hear it if you listen.'),
  collectible('cursed-any', 'The Cursed `any`', 'rare', '🫥', 'Makes every type say yes. Every single one. Do not let it near your codebase.'),
  collectible('legacy-codebase', 'Haunted Legacy Codebase', 'rare', '👻', 'Nobody understands it. Nobody dares delete it. It runs the payroll.'),
  collectible('git-blame', 'Mirror of Git Blame', 'rare', '🪞', 'Shows you who wrote the worst line in the file. It is always you, from six months ago.'),
  collectible('regex', 'Regular Expression Charm', 'rare', '🔣', '/^(?:[a-z0-9!#$%&\'*+/=?^_`{|}~-]+)$/ — nobody remembers what it matches. It wards off email addresses.'),
  collectible('deprecated', 'Deprecated Warning Sign', 'rare', '⚠', 'Yellow, triangular, and ignored by everyone for years.'),
  collectible('production-db', 'Key to the Production Database', 'epic', '🗝', 'Comes with a note: "Please, please, please use a transaction."'),
  collectible('10x-cape', 'Cape of the 10x Engineer', 'epic', '🦸', 'Mythical. Several people claim to have seen one. Their teammates disagree.'),
  collectible('friday-deploy', 'Friday Afternoon Deploy Button', 'epic', '🔴', 'Big, red, and pressed by brave fools at 4:55 pm. Comes with a weekend\'s worth of pager alerts.'),
  collectible('compiler-blessing', 'Blessing of the Compiler', 'epic', '✨', 'Zero errors, zero warnings, first try. The compiler smiled, once. This is proof.'),
  collectible('golden-semicolon', 'The Golden Semicolon', 'legendary', '🏆', 'Forged from the final statement of the first program ever to compile without warnings.'),
  collectible('last-working-build', 'The Last Working Build', 'legendary', '💾', 'Before the refactor. Before the dependency update. Before everything went wrong. Treasure it.'),
  collectible('orrery-heart', 'Heart of the Orrery', 'celestial', '💠', 'The reactor core\'s first spark, crystallised. Awarded to the engineer who brought the station back to life.'),
];

const title = (id: string, name: string, rarity: Rarity, extra: Partial<Item> = {}): Item => ({ id, kind: 'title', name, rarity, icon: '🎖', description: `A title to wear under your name: “${name}”.`, ...extra });

export const TITLES: Item[] = [
  title('title-crawler', 'Fresh Recruit', 'common'),
  title('title-semicolon', 'Semicolon Survivor', 'common', { drops: true }),
  title('title-debugger', 'Professional Debugger', 'uncommon', { drops: true }),
  title('title-console', 'Console Whisperer', 'uncommon', { drops: true, price: 150 }),
  title('title-loop', 'Lord of the Loops', 'uncommon', { drops: true }),
  title('title-async', 'Awaiter of Promises', 'rare', { drops: true }),
  title('title-types', 'Type Whisperer', 'rare', { drops: true, price: 400 }),
  title('title-hooks', 'Hook Wrangler', 'rare', { drops: true }),
  title('title-a11y', 'Champion of Accessibility', 'epic', { drops: true }),
  title('title-boss', 'Boss Slayer', 'rare'),
  title('title-perfect', 'the Perfectionist', 'epic'),
  title('title-architect', 'Reactor Architect', 'legendary'),
  title('title-celebrity', 'Galactic Celebrity', 'legendary'),
  title('title-production', 'Production Engineer', 'legendary'),
];

const theme = (id: string, name: string, rarity: Rarity, description: string, price?: number): Item => ({ id, kind: 'theme', name, rarity, icon: '🎨', description, drops: true, price });

export const THEMES: Item[] = [
  { id: 'theme-reactor', kind: 'theme', name: 'Reactor Glow', rarity: 'common', icon: '🎨', description: 'The station\'s standard issue: cool blue, warm amber.' },
  theme('theme-phosphor', 'Phosphor Terminal', 'uncommon', 'Green on black, like the machines your grandparents swore at.', 250),
  theme('theme-solar', 'Solar Flare', 'uncommon', 'Hot ambers and oranges. Wear sunglasses.', 250),
  theme('theme-nebula', 'Nebula', 'rare', 'Deep purples and pinks from the edge of the galaxy.', 400),
  theme('theme-arctic', 'Arctic Station', 'rare', 'Icy blues and crisp whites.', 400),
  theme('theme-gold', 'Gilded Console', 'legendary', 'Gold leaf on obsidian. Tasteful? No. Earned? Absolutely.'),
];

const hat = (id: string, name: string, rarity: Rarity, icon: string, price?: number): Item => ({ id, kind: 'hat', name, rarity, icon, description: `A ${name.toLowerCase()} for your companion.`, drops: true, price });

export const HATS: Item[] = [
  hat('hat-party', 'Party Hat', 'common', '🥳', 80),
  hat('hat-hard', 'Hard Hat', 'common', '⛑', 80),
  hat('hat-headphones', 'Headphones', 'uncommon', '🎧', 150),
  hat('hat-cap', 'Propeller Cap', 'uncommon', '🧢', 150),
  hat('hat-top', 'Top Hat', 'rare', '🎩', 300),
  hat('hat-wizard', 'Wizard Hat', 'rare', '🧙'),
  hat('hat-crown', 'Tiny Crown', 'epic', '👑'),
  hat('hat-halo', 'Halo', 'legendary', '😇'),
];

const scroll = (id: string, name: string, rarity: Rarity, drops: boolean, body: string): Item => ({ id, kind: 'scroll', name, rarity, icon: '📜', description: 'A Codex scroll: a cheat sheet you keep forever. Read it in your inventory.', drops, body });

export const SCROLLS: Item[] = [
  scroll('scroll-basics', 'Scroll of First Principles', 'uncommon', false, `## Values and variables
\`\`\`ts
const name = "Ada";      // string: text in quotes
let fuel = 50;           // number; let can be reassigned
const ok = fuel > 10;    // boolean: true or false
fuel = fuel + 5;         // or fuel += 5
console.log(\`\${name} has \${fuel}\`);   // template string
\`\`\`
## Decisions and functions
\`\`\`ts
export function grade(score: number): string {
  if (score > 90) return "A";
  else if (score > 75) return "B";
  else return "C";
}
\`\`\`
- \`===\` compares, \`=\` assigns. \`&&\` and, \`||\` or, \`!\` not.
- Order: ( ) first, then * / %, then + -.`),
  scroll('scroll-collections', 'Scroll of Collections', 'uncommon', false, `## Arrays
\`\`\`ts
const xs = [3, 9, 14];
xs[0]; xs.length; xs[xs.length - 1];   // first, count, last
xs.push(20);                            // add to end
for (const x of xs) { … }               // each item
\`\`\`
## Array methods
| Method | Gives |
|---|---|
| \`map(fn)\` | new array, each item transformed |
| \`filter(fn)\` | new array, only items that pass |
| \`find(fn)\` | first match, or undefined |
| \`some / every\` | boolean |
| \`includes(x)\` | boolean |
| \`reduce(fn, start)\` | one value |
## Objects
\`\`\`ts
const ship = { name: "Kite", crew: 4 };
ship.crew = 5;
type Ship = { name: string; crew: number };
\`\`\``),
  scroll('scroll-modern', 'Scroll of Modern JavaScript', 'rare', false, `## Shapes
\`\`\`ts
const { name, crew = 1 } = ship;     // destructuring + default
const [first, ...rest] = list;       // rest
const copy = { ...ship, crew: 5 };   // spread: new object
const more = [...list, "x"];         // spread: new array
ship.pilot?.name ?? "unassigned";    // optional chaining + nullish fallback
\`\`\`
## Functions
\`\`\`ts
const double = (n: number) => n * 2;
function makeCounter() { let n = 0; return () => ++n; }   // closure
\`\`\`
## Errors and async
\`\`\`ts
try { risky(); } catch (e) { … }
throw new Error("Clear message");
const x = await api();                          // inside async functions
const all = await Promise.all(ids.map(api));    // in parallel
\`\`\``),
  scroll('scroll-types', 'Scroll of Types', 'rare', false, `## Annotations
\`\`\`ts
function f(a: number, b: string[]): boolean { … }
let id: string | number;          // union
type Dir = "up" | "down";         // literal union
interface Ship { readonly id: number; name: string; motto?: string }
\`\`\`
## Narrowing
\`typeof x === "string"\`, \`Array.isArray(x)\`, \`x === null\`, \`"prop" in x\`, checking a tag like \`x.kind === "ship"\`.
## Remember
- \`unknown\` must be narrowed; \`any\` turns checking off.
- \`T | null\` / \`T | undefined\` for "maybe nothing".`),
  scroll('scroll-generics', 'Scroll of Generics', 'rare', false, `## Generics
\`\`\`ts
function first<T>(xs: T[]): T | undefined { return xs[0]; }
function get<T, K extends keyof T>(o: T, k: K): T[K] { return o[k]; }
\`\`\`
## Utility types
| Type | Does |
|---|---|
| \`Partial<T>\` | all optional |
| \`Required<T>\` | all required |
| \`Readonly<T>\` | all readonly |
| \`Pick<T, K>\` / \`Omit<T, K>\` | keep / drop keys |
| \`Record<K, V>\` | object with keys K |
## Exhaustive switches
\`default: { const x: never = value; }\` errors if a case is missing.`),
  scroll('scroll-vault', 'Scroll of the Vault', 'epic', false, `## Type guards
\`\`\`ts
function isShip(x: unknown): x is Ship { … }
\`\`\`
## Type-level tools
\`\`\`ts
type Flags<T> = { [K in keyof T]: boolean };                  // mapped
type Elem<T> = T extends (infer U)[] ? U : never;             // conditional + infer
type Code = \`\${"A" | "B"}\${1 | 2}\`;                           // template literal
type Get<T> = { [K in keyof T & string as \`get\${Capitalize<K>}\`]: () => T[K] };
const CFG = { … } as const satisfies Record<string, Route>;   // exact + checked
type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };
\`\`\``),
  scroll('scroll-components', 'Scroll of Components', 'rare', false, `## Components
\`\`\`tsx
interface Props { title: string; count?: number; children: ReactNode }
export function Card({ title, count = 0, children }: Props) {
  return <section className="card"><h2>{title} ({count})</h2>{children}</section>;
}
\`\`\`
- Capitalised names; \`className\`; \`{expressions}\`; one root (or \`<>…</>\`).
- Lists: \`items.map((i) => <li key={i.id}>…</li>)\`, with stable keys.
- Conditionals: \`cond ? a : b\`, \`count > 0 && …\` (never \`count && …\`).`),
  scroll('scroll-state', 'Scroll of State', 'rare', false, `## useState
\`\`\`tsx
const [items, setItems] = useState<Item[]>([]);
setItems([...items, item]);                       // add
setItems(items.filter((i) => i.id !== id));       // remove
setItems(items.map((i) => i.id === id ? { ...i, done: true } : i));   // update
setCount((c) => c + 1);                           // based on previous
\`\`\`
## Inputs and forms
\`\`\`tsx
<input value={text} onChange={(e) => setText(e.target.value)} />
<form onSubmit={(e) => { e.preventDefault(); … }}>
\`\`\`
- Never mutate state. Derive what you can. Lift shared state up.`),
  scroll('scroll-hooks', 'Scroll of Hooks', 'epic', false, `## Effects
\`\`\`tsx
useEffect(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);       // cleanup
}, [deps]);
\`\`\`
## The rest
\`\`\`tsx
const ref = useRef<HTMLInputElement>(null);  ref.current?.focus();
const [state, dispatch] = useReducer(reducer, initial);
const Ctx = createContext<Value | null>(null);   <Ctx value={v}>…</Ctx>   useContext(Ctx);
function useToggle(init = false): [boolean, () => void] { … }   // custom hook
\`\`\`
- Hooks: top level only, same order every render.`),
  scroll('scroll-production', 'Scroll of Production', 'legendary', false, `## Network data
- Always design **loading**, **error**, **empty** and **loaded** states.
- Ignore stale responses: \`let stale = false; … return () => { stale = true; }\`.
- Debounce user input before requesting.
## Performance
- Measure first. \`useMemo\` for expensive work; \`memo\` + \`useCallback\` for skipping renders.
## Accessibility
- Real \`<label htmlFor>\`; \`aria-invalid\`, \`aria-describedby\`; roles and states on custom widgets; full keyboard support; manage focus.
## Resilience and testing
- Error boundaries around independent regions.
- Test boundaries, each rule alone, combinations, invalid input.`),
  scroll('scroll-debugging', 'Scroll of Debugging', 'rare', true, `## A method that always works
1. **Reproduce** it reliably. If you can't trigger it, you can't confirm a fix.
2. **Read the error message**, all of it, including the line number.
3. **Check your assumptions**: \`console.log\` the values you're *sure* about.
4. **Halve the problem**: comment out half the code; which half has the bug?
5. **Explain it out loud** (the rubber duck method).
6. Fix it, then add a test so it never comes back.`),
  scroll('scroll-errors', 'Scroll of Reading Errors', 'uncommon', true, `## Common compiler messages, translated
| Message | Means |
|---|---|
| *X is not assignable to type Y* | You gave an X where a Y was promised |
| *Property P does not exist on type T* | Typo, or you haven't narrowed a union |
| *Object is possibly 'undefined'* | Check it first, or use \`?.\` / \`??\` |
| *Parameter implicitly has an 'any' type* | Annotate the parameter |
| *Cannot assign to X because it is a constant* | Use \`let\`, or don't reassign |
| *Cannot find name X* | Not declared, misspelled, or not imported |`),
  scroll('scroll-naming', 'Scroll of Naming Things', 'uncommon', true, `## Names are documentation
- Booleans read as questions: \`isOpen\`, \`hasFuel\`, \`canLaunch\`.
- Functions are verbs: \`loadCrew\`, \`formatId\`; components are nouns: \`CrewList\`.
- Plurals for lists: \`ships\`; singular in loops: \`for (const ship of ships)\`.
- Say what it *is*, not its type: \`retryCount\`, not \`num\`.
- Short names for short scopes (\`i\`, \`x\`), long names for long ones.`),
  scroll('scroll-git', 'Scroll of Git', 'rare', true, `## The daily loop
\`\`\`
git status                    # what changed?
git diff                      # how?
git add -p                    # stage pieces, reviewing each
git commit -m "Add crew search"
git pull --rebase && git push
\`\`\`
## Branches
\`\`\`
git switch -c fix-login       # new branch
git switch main               # back
\`\`\`
- Small commits with clear messages: *what* changed and *why*.`),
  scroll('scroll-review', 'Scroll of Code Review', 'epic', true, `## Reviewing someone else's code
- Read the description first: what is this *supposed* to do?
- Check behaviour before style: edge cases, errors, empty states, accessibility.
- Ask questions instead of giving orders: "What happens if the list is empty?"
- Praise what's good. Be specific about what isn't.
## Having your code reviewed
- Keep changes small. Explain the *why*. Thank people. Nobody's code is perfect, including the reviewer's.`),
];

export const ALL_ITEMS: Item[] = [...COLLECTIBLES, ...TITLES, ...THEMES, ...HATS, ...SCROLLS];
const BY_ID = new Map(ALL_ITEMS.map((i) => [i.id, i]));

export function item(id: string): Item {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown item ${id}`);
  return found;
}

/** The scroll each floor's boss guarantees, by floor id. */
export const FLOOR_SCROLLS: Record<string, string> = {
  boot: 'scroll-basics',
  supply: 'scroll-collections',
  modern: 'scroll-modern',
  foundry: 'scroll-types',
  lab: 'scroll-generics',
  vault: 'scroll-vault',
  bay: 'scroll-components',
  control: 'scroll-state',
  core: 'scroll-hooks',
  production: 'scroll-production',
};
