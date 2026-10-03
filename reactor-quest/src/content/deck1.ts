import type { Deck } from '../game/types';
import { codeFiles, fnOf } from './helpers';

export const deck1: Deck = {
  id: 'foundry',
  name: 'Type Foundry',
  subtitle: 'TypeScript basics',
  hue: 190,
  levels: [
    {
      kind: 'code',
      id: 'power-bus',
      title: 'Annotate the Power Bus',
      system: 'Power Bus',
      ...codeFiles('power-bus', 'ts'),
      brief: `**ARIA:** Welcome aboard, engineer. Orrery Station has been dark for nine days. Every system aboard is written in TypeScript — and the compiler refuses to bring a system online while it has type errors.

Let's start small. The power bus adds two voltages, but nobody told the compiler *what* they are.`,
      lesson: `## Type annotations

TypeScript is JavaScript with **types**: labels that say what kind of value a variable holds. You write them after a colon.

\`\`\`ts
let fuel: number = 80;
let pilot: string = "Nova";
let docked: boolean = true;
\`\`\`

Function **parameters** are annotated the same way, and you can annotate the **return type** after the parentheses:

\`\`\`ts
function double(n: number): number {
  return n * 2;
}
\`\`\`

With \`strict\` mode on (it always is on this station), a parameter with no annotation is an error: TypeScript won't silently treat it as \`any\` — "could be anything, check nothing".

Once \`a\` and \`b\` are numbers, the compiler will also **stop** anyone calling \`addVoltage("2", 3)\` — that would have produced the string \`"23"\`, not \`5\`.

**Tip:** hover over any name in the editor to see the type TypeScript gave it. Try it on \`a\` before and after you annotate it.`,
      hints: [
        'The error says the parameters implicitly have an `any` type. Give each one a type after a colon.',
        'Voltages are numbers: `a: number`.',
        '`export function addVoltage(a: number, b: number): number { … }`',
      ],
      typeChecks: [
        { label: 'Strings are rejected', code: `import { addVoltage } from './solution';\n// @ts-expect-error\naddVoltage('2', 3);` },
        { label: 'Returns a number', code: `import { addVoltage } from './solution';\nconst v: number = addVoltage(1, 2);` },
      ],
      checks: [
        { label: 'addVoltage(2, 3) is 5', run: ({ mod, expect }) => expect(fnOf(mod, 'addVoltage')(2, 3)).toBe(5) },
        { label: 'addVoltage(0.5, 0.25) is 0.75', run: ({ mod, expect }) => expect(fnOf(mod, 'addVoltage')(0.5, 0.25)).toBe(0.75) },
      ],
    },
    {
      kind: 'code',
      id: 'comms-relay',
      title: 'Read the Compiler',
      system: 'Comms Relay',
      ...codeFiles('comms-relay', 'ts'),
      brief: `**ARIA:** The comms relay has type annotations — they're just *wrong*. Someone wrote them in a hurry.

The red squiggles are the compiler talking to you. Hover them, read them, and they'll tell you exactly what's wrong.`,
      lesson: `## Primitive types and return types

The three types you'll use most:

| type | values |
|---|---|
| \`string\` | \`"hello"\`, \`'Nova'\` |
| \`number\` | \`42\`, \`3.14\`, \`-1\` (no separate int/float) |
| \`boolean\` | \`true\`, \`false\` |

A **return type** is a promise about what comes back. If the function body breaks the promise, the compiler says so:

\`\`\`ts
function name(): number {
  return "Nova"; // ✖ Type 'string' is not assignable to type 'number'.
}
\`\`\`

"**X is not assignable to Y**" is the most common message you'll see. Read it as: *you gave me an X where I was promised a Y*.

## Inference

You don't have to annotate everything. TypeScript **infers** types from values:

\`\`\`ts
let count = 3;        // count: number
const ok = count > 2; // ok: boolean
\`\`\`

A good habit: annotate **function parameters and exported return types**, let inference handle the rest.

Hover over a name in the editor to see what TypeScript inferred for it. The autocomplete list (it pops up as you type, or press **Ctrl+Space**) comes from the same compiler.`,
      hints: [
        'Template strings (backticks) produce a `string`, so `hail` must return `string`.',
        '`isPriority` compares a number: `sector < 10` — that makes `sector` a `number` and the result a `boolean`.',
        '`export function isPriority(sector: number): boolean { return sector < 10; }`',
      ],
      typeChecks: [
        { label: 'hail returns a string', code: `import { hail } from './solution';\nconst s: string = hail('Vega', 3);` },
        { label: 'isPriority takes a number and returns a boolean', code: `import { isPriority } from './solution';\nconst b: boolean = isPriority(4);\n// @ts-expect-error\nisPriority('4');` },
      ],
      checks: [
        { label: 'hail("Vega", 3) → "Hailing Vega in sector 3"', run: ({ mod, expect }) => expect(fnOf(mod, 'hail')('Vega', 3)).toBe('Hailing Vega in sector 3') },
        { label: 'isPriority(4) is true', run: ({ mod, expect }) => expect(fnOf(mod, 'isPriority')(4)).toBe(true) },
        { label: 'isPriority(10) is false', run: ({ mod, expect }) => expect(fnOf(mod, 'isPriority')(10)).toBe(false) },
      ],
    },
    {
      kind: 'code',
      id: 'cargo-manifest',
      title: 'Arrays and Tuples',
      system: 'Cargo Manifest',
      ...codeFiles('cargo-manifest', 'ts'),
      brief: `**ARIA:** The cargo bay is full of unlabelled crates. I need the total mass for the docking clamps, and the heaviest crate so the loader knows where to start.`,
      lesson: `## Arrays

An array of numbers is \`number[]\` (you'll also see \`Array<number>\` — same thing). Every element has the same type.

\`\`\`ts
const masses: number[] = [120, 80, 310];
for (const m of masses) { /* m: number */ }
masses.forEach((m, i) => { /* m: number, i: number */ });
\`\`\`

## Tuples

A **tuple** is a fixed-length array where each position has its own type. Useful for returning two things at once:

\`\`\`ts
function minMax(xs: number[]): [number, number] {
  return [Math.min(...xs), Math.max(...xs)];
}
const [lo, hi] = minMax([3, 9, 1]); // destructured
\`\`\`

You can **label** tuple positions for readability: \`[index: number, mass: number]\`.

Why not just \`number[]\`? Because a tuple knows its length: \`minMax(xs)[2]\` is a compile error. With \`number[]\`, TypeScript would let it through and you'd get \`undefined\` at runtime.`,
      hints: [
        '`totalMass` needs a parameter type: `masses: number[]`, and a `number` return.',
        'For `heaviest`, track the best index and mass while looping, starting from `-1` and `0`. Change the return type to a tuple.',
        'Return type: `[index: number, mass: number]`, and `return [index, mass];`',
      ],
      typeChecks: [
        { label: 'totalMass only accepts numbers', code: `import { totalMass } from './solution';\nconst t: number = totalMass([1, 2]);\n// @ts-expect-error\ntotalMass(['3']);` },
        { label: 'heaviest returns a two-item tuple', code: `import { heaviest } from './solution';\nconst [i, m] = heaviest([4, 9]);\nconst a: number = i;\nconst b: number = m;\n// @ts-expect-error\nheaviest([1])[2];` },
      ],
      checks: [
        { label: 'totalMass([120, 80, 310]) is 510', run: ({ mod, expect }) => expect(fnOf(mod, 'totalMass')([120, 80, 310])).toBe(510) },
        { label: 'totalMass([]) is 0', run: ({ mod, expect }) => expect(fnOf(mod, 'totalMass')([])).toBe(0) },
        { label: 'heaviest([120, 80, 310, 50]) is [2, 310]', run: ({ mod, expect }) => expect(fnOf(mod, 'heaviest')([120, 80, 310, 50])).toEqual([2, 310]) },
        { label: 'heaviest works with negative values', run: ({ mod, expect }) => expect(fnOf(mod, 'heaviest')([-5, -2, -9])).toEqual([1, -2]) },
        { label: 'heaviest([]) is [-1, 0]', run: ({ mod, expect }) => expect(fnOf(mod, 'heaviest')([])).toEqual([-1, 0]) },
      ],
    },
    {
      kind: 'code',
      id: 'crew-registry',
      title: 'Interfaces',
      system: 'Crew Registry',
      ...codeFiles('crew-registry', 'ts'),
      brief: `**ARIA:** The crew registry lost its schema. I can't print ID badges until we describe what a crew member *is*.`,
      lesson: `## Object types with \`interface\`

An **interface** names the shape of an object: which properties it has, and their types.

\`\`\`ts
interface Ship {
  readonly hull: string; // can't be reassigned after creation
  name: string;
  crew: number;
  motto?: string;        // optional: string | undefined
}

const s: Ship = { hull: "NX-1", name: "Kite", crew: 4 };
s.name = "Swift"; // fine
s.hull = "NX-2";  // ✖ Cannot assign to 'hull' because it is a read-only property.
\`\`\`

Leave out a required property and the compiler complains. Add one that isn't in the interface and it complains too (that catches typos like \`nmae\`).

An **optional** property (\`?\`) might be \`undefined\`, so check it before you use it:

\`\`\`ts
const line = s.motto ? \`"\${s.motto}"\` : "";
\`\`\`

(\`type Ship = { … }\` does nearly the same job. Interfaces are the common choice for object shapes.)`,
      hints: [
        'Four properties: `id`, `name`, `role`, `callsign`. Which one is optional? Which one can never change?',
        '`readonly id: number;` and `callsign?: string;`',
        'In `badge`, build the callsign part first: ``const call = member.callsign ? ` "${member.callsign}"` : "";``',
      ],
      typeChecks: [
        { label: 'A member without a callsign is valid', code: `import type { CrewMember } from './solution';\nconst m: CrewMember = { id: 1, name: 'Ada', role: 'pilot' };` },
        { label: 'callsign is a string when present', code: `import type { CrewMember } from './solution';\nconst m: CrewMember = { id: 1, name: 'Ada', role: 'pilot', callsign: 'Ace' };\n// @ts-expect-error\nconst n: CrewMember = { id: 1, name: 'Ada', role: 'pilot', callsign: 7 };` },
        { label: 'role is required', code: `import type { CrewMember } from './solution';\n// @ts-expect-error\nconst m: CrewMember = { id: 1, name: 'Ada' };` },
        { label: 'id is readonly', code: `import type { CrewMember } from './solution';\nconst m: CrewMember = { id: 1, name: 'Ada', role: 'pilot' };\n// @ts-expect-error\nm.id = 2;` },
      ],
      checks: [
        { label: 'Badge without a callsign', run: ({ mod, expect }) => expect(fnOf(mod, 'badge')({ id: 1, name: 'Ada Okafor', role: 'engineer' })).toBe('Ada Okafor — engineer') },
        { label: 'Badge with a callsign', run: ({ mod, expect }) => expect(fnOf(mod, 'badge')({ id: 2, name: 'Ada Okafor', role: 'engineer', callsign: 'Sparks' })).toBe('Ada Okafor "Sparks" — engineer') },
      ],
    },
    {
      kind: 'code',
      id: 'signal-decoder',
      title: 'Unions and Narrowing',
      system: 'Signal Decoder',
      ...codeFiles('signal-decoder', 'ts'),
      brief: `**ARIA:** Incoming signals use two id formats — old beacons send numbers, new ones send strings. The decoder assumes everything is a string and crashes on the first beacon.`,
      lesson: `## Union types

A **union** \`A | B\` means "either an A or a B":

\`\`\`ts
let id: string | number;
id = "KX-7"; // ok
id = 42;     // ok
\`\`\`

You can only use what **every** member supports. \`id.toUpperCase()\` is an error — numbers don't have it.

## Narrowing

Check which one you have, and inside that branch TypeScript **narrows** the type:

\`\`\`ts
function show(id: string | number) {
  if (typeof id === "number") {
    return id.toFixed(0);     // id: number here
  }
  return id.toUpperCase();    // id: string here
}
\`\`\`

Narrowing tools: \`typeof x === "string"\`, \`Array.isArray(x)\`, \`x === null\`, \`"prop" in x\`, and truthiness checks.

Handy: \`String(42).padStart(4, "0")\` gives \`"0042"\`.`,
      hints: [
        'In `formatId`, check `typeof id === "number"` first and return early.',
        '`"#" + String(id).padStart(4, "0")` turns 42 into `"#0042"`.',
        '`channelLabel(channel: string | string[]): string` — use `Array.isArray(channel) ? channel.join(", ") : channel`.',
      ],
      typeChecks: [
        { label: 'formatId accepts strings and numbers only', code: `import { formatId } from './solution';\nformatId(7);\nformatId('kx');\n// @ts-expect-error\nformatId(true);` },
        { label: 'channelLabel takes a string or a string[]', code: `import { channelLabel } from './solution';\nconst a: string = channelLabel('alpha');\nconst b: string = channelLabel(['a', 'b']);\n// @ts-expect-error\nchannelLabel([1, 2]);` },
      ],
      checks: [
        { label: 'formatId(42) → "#0042"', run: ({ mod, expect }) => expect(fnOf(mod, 'formatId')(42)).toBe('#0042') },
        { label: 'formatId(12345) → "#12345"', run: ({ mod, expect }) => expect(fnOf(mod, 'formatId')(12345)).toBe('#12345') },
        { label: 'formatId("kx-7") → "KX-7"', run: ({ mod, expect }) => expect(fnOf(mod, 'formatId')('kx-7')).toBe('KX-7') },
        { label: 'channelLabel("alpha") → "alpha"', run: ({ mod, expect }) => expect(fnOf(mod, 'channelLabel')('alpha')).toBe('alpha') },
        { label: 'channelLabel(["alpha", "beta"]) → "alpha, beta"', run: ({ mod, expect }) => expect(fnOf(mod, 'channelLabel')(['alpha', 'beta'])).toBe('alpha, beta') },
      ],
    },
    {
      kind: 'quiz',
      id: 'quiz-inference',
      title: 'Compiler Diagnostics',
      system: 'Diagnostics Bay',
      brief: `**ARIA:** Before I let you near the reactor telemetry, a quick calibration. Think like the compiler.`,
      lesson: `## Thinking like the compiler

- \`let\` variables get a **widened** type (\`let x = 5\` → \`number\`); \`const\` keeps the **literal** (\`const x = 5\` → \`5\`).
- An optional parameter \`x?: T\` is \`T | undefined\` inside the function.
- Types are **erased** when TypeScript compiles to JavaScript — they cost nothing at runtime, and they can't be checked at runtime either.
- \`any\` switches checking **off**. \`unknown\` is the safe version: you must narrow it before use.`,
      questions: [
        {
          prompt: 'What does the compiler say?',
          code: `let x = 5;\nx = "five";`,
          options: ['Nothing — it compiles', "Type 'string' is not assignable to type 'number'", 'x becomes string | number', 'It fails at runtime, not compile time'],
          answer: 1,
          explain: '`let x = 5` infers `x: number`. Assigning a string later is an error — the type was fixed when x was declared.',
        },
        {
          prompt: 'What is the type of `mode`?',
          code: `const mode = "warp";`,
          options: ['string', '"warp"', 'any', 'String'],
          answer: 1,
          explain: 'A `const` can never change, so TypeScript gives it the **literal type** `"warp"`. With `let`, it would widen to `string`.',
        },
        {
          prompt: 'Inside this function, what is the type of `deck`?',
          code: `function goTo(deck?: number) {\n  // here\n}`,
          options: ['number', 'number | undefined', 'number | null', 'any'],
          answer: 1,
          explain: 'An optional parameter may be omitted, so it can be `undefined`. You need to check before doing arithmetic with it.',
        },
        {
          prompt: 'What is inferred for `mixed`?',
          code: `const mixed = [1, "a"];`,
          options: ['(string | number)[]', '[number, string]', 'any[]', 'unknown[]'],
          answer: 0,
          explain: 'Array literals infer an array of the union of element types. To get the tuple `[number, string]`, annotate it or write `as const`.',
        },
        {
          prompt: 'Which of these lets you call `.toUpperCase()` on it **without** checking first?',
          options: ['unknown', 'any', 'never', 'object'],
          answer: 1,
          explain: '`any` turns type checking off — which is exactly why it is dangerous. `unknown` forces you to narrow first (e.g. `typeof v === "string"`).',
        },
        {
          prompt: 'This program compiles. What happens when the JavaScript runs?',
          code: `interface Pilot { name: string }\nconst p = JSON.parse('{"nmae": "Nova"}') as Pilot;\nconsole.log(p.name.length);`,
          options: ['A compile error', 'It logs 4', 'A runtime TypeError', 'It logs undefined'],
          answer: 2,
          explain: 'Types are erased at runtime. `as Pilot` is a promise *you* made to the compiler — it is not checked. `p.name` is `undefined`, and `undefined.length` throws.',
        },
      ],
    },
    {
      kind: 'code',
      id: 'telemetry',
      title: 'BOSS: Reactor Telemetry',
      system: 'Reactor Telemetry',
      boss: true,
      ...codeFiles('telemetry', 'ts'),
      brief: `**ARIA:** This is it for the Foundry — the reactor's telemetry feed. Half the sensors are offline and report \`null\`. If the summary averages a \`null\` in as zero, the core will read cold and over-fuel itself.

Everything you've learned: interfaces, arrays, unions with \`null\`, narrowing.`,
      lesson: `## \`null\` in a union

With \`strictNullChecks\` (part of \`strict\`), \`null\` is **not** a valid \`number\`. A value that might be missing is written \`number | null\`, and you must narrow before using it:

\`\`\`ts
for (const r of readings) {
  if (r.value === null) continue;
  total += r.value; // r.value: number here
}
\`\`\`

## Returning "maybe nothing"

Two conventions:
- \`T | null\` — "deliberately empty" (an average of zero readings).
- \`T | undefined\` — "not found" (what \`Array.prototype.find\` returns).

Put it in the return type, so callers are forced to handle the empty case:

\`\`\`ts
function find(id: number): Ship | undefined { … }
\`\`\`

Useful: \`xs.reduce((a, b) => a + b, 0)\` sums an array; \`??\` supplies a fallback for \`null\`/\`undefined\`.`,
      hints: [
        '`Summary` needs three properties: `online: number; offline: number; average: number | null;`',
        'In `summarize`, collect the non-null values into a `number[]` first. `online` is its length, `offline` is the rest.',
        '`hottest` returns `Reading | undefined`. Skip readings whose `value` is `null`; keep the best one seen so far.',
      ],
      typeChecks: [
        { label: 'Summary.average is number | null', code: `import { summarize } from './solution';\nconst s = summarize([]);\nconst n: number = s.online + s.offline;\nconst a: number | null = s.average;\n// @ts-expect-error\nconst b: number = s.average;` },
        { label: 'hottest may return undefined', code: `import { hottest, type Reading } from './solution';\nconst r = hottest([]);\nconst ok: Reading | undefined = r;\n// @ts-expect-error\nconst bad: Reading = r;` },
      ],
      checks: [
        {
          label: 'Counts online and offline sensors',
          run: ({ mod, expect }) => {
            const s = fnOf(mod, 'summarize')([{ sensor: 'a', value: 300 }, { sensor: 'b', value: null }, { sensor: 'c', value: 500 }]);
            expect(s.online).toBe(2);
            expect(s.offline).toBe(1);
          },
        },
        {
          label: 'Averages only online values',
          run: ({ mod, expect }) => expect(fnOf(mod, 'summarize')([{ sensor: 'a', value: 300 }, { sensor: 'b', value: null }, { sensor: 'c', value: 500 }]).average).toBe(400),
        },
        {
          label: 'average is null when every sensor is offline',
          run: ({ mod, expect }) => {
            expect(fnOf(mod, 'summarize')([{ sensor: 'a', value: null }]).average).toBeNull();
            expect(fnOf(mod, 'summarize')([]).average).toBeNull();
          },
        },
        {
          label: 'A reading of 0 is online, not missing',
          run: ({ mod, expect }) => expect(fnOf(mod, 'summarize')([{ sensor: 'a', value: 0 }, { sensor: 'b', value: 10 }])).toEqual({ online: 2, offline: 0, average: 5 }),
        },
        {
          label: 'hottest finds the highest online reading',
          run: ({ mod, expect }) => expect(fnOf(mod, 'hottest')([{ sensor: 'a', value: -20 }, { sensor: 'b', value: null }, { sensor: 'c', value: -5 }])).toEqual({ sensor: 'c', value: -5 }),
        },
        {
          label: 'hottest returns undefined when nothing is online',
          run: ({ mod, expect }) => expect(fnOf(mod, 'hottest')([{ sensor: 'a', value: null }])).toBe(undefined),
        },
      ],
    },
  ],
};
