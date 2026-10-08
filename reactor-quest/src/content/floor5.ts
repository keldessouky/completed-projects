import type { Deck } from '../game/types';
import { blankPage, codeFiles, fnOf } from './helpers';

export const floor5: Deck = {
  id: 'lab',
  name: 'Generics Lab',
  subtitle: 'TypeScript power tools',
  outcome: 'You can write reusable, type-safe code with unions, generics and utility types.',
  hue: 275,
  levels: [
    {
      kind: 'code',
      id: 'literal-locks',
      skills: ['types'],
      title: 'Literal Types',
      system: 'Airlock Doors',
      ...codeFiles('literal-locks', 'ts'),
      brief: `**ARIA:** Deck 2's airlocks accept any string as a state. Last week someone set a door to \`"Open"\` with a capital O. The door did… nothing. It was not a good week.`,
      lesson: `## Literal types

A type can be one exact value: \`"open"\` is a type whose only value is the string \`"open"\`. Unions of literals make precise, self-documenting types:

\`\`\`ts
type Direction = "north" | "south" | "east" | "west";

let heading: Direction = "north"; // ok
heading = "North";                // ✖ not assignable to type 'Direction'
\`\`\`

The editor will even autocomplete the options for you.

## Type aliases

\`type Name = …\` gives any type a name — unions, literals, objects, functions. Use it like any other type, and \`export\` it so other files can too.

Literal unions also work for numbers: \`type Dice = 1 | 2 | 3 | 4 | 5 | 6;\``,
      hints: [
        'Change `export type Door = string;` to a union of the three states.',
        'The three states are `"open"`, `"closed"` and `"locked"`.',
        "`export type Door = 'open' | 'closed' | 'locked';`",
      ],
      typeChecks: [
        { label: 'Valid states are accepted', code: `import { next, type Door } from './solution';\nconst a: Door = 'open';\nconst b: Door = next('closed');\nconst c: Door = 'locked';` },
        { label: 'Typos are rejected', code: `import type { Door } from './solution';\n// @ts-expect-error\nconst d: Door = 'Open';\n// @ts-expect-error\nconst e: Door = 'ajar';` },
        { label: 'next() only takes real states', code: `import { next } from './solution';\n// @ts-expect-error\nnext('sealed');` },
      ],
      checks: [
        { label: 'open → closed → locked → open', run: ({ mod, expect }) => {
          const next = fnOf(mod, 'next');
          expect(next('open')).toBe('closed');
          expect(next('closed')).toBe('locked');
          expect(next('locked')).toBe('open');
        } },
        { label: 'Only a closed door can be locked', run: ({ mod, expect }) => {
          const canLock = fnOf(mod, 'canLock');
          expect(canLock('closed')).toBe(true);
          expect(canLock('open')).toBe(false);
          expect(canLock('locked')).toBe(false);
        } },
      ],
    },
    {
      kind: 'code',
      id: 'alarm-router',
      skills: ['narrowing', 'types'],
      title: 'Discriminated Unions',
      system: 'Alarm Router',
      ...codeFiles('alarm-router', 'ts'),
      brief: `**ARIA:** The alarm router handles fires and hull breaches. Then an intruder alarm came in, and the router announced a "Breach on deck undefined at undefined kPa". The crew was confused. The intruder was delighted.`,
      lesson: `## Discriminated unions

A union of object types that share a **tag** property with a literal type:

\`\`\`ts
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rect"; w: number; h: number };
\`\`\`

Checking the tag narrows to exactly one member, and unlocks its properties:

\`\`\`ts
function area(s: Shape) {
  switch (s.kind) {
    case "circle": return Math.PI * s.radius ** 2; // s: circle
    case "rect":   return s.w * s.h;               // s: rect
  }
}
\`\`\`

This is the most useful pattern in TypeScript. It's how you'll type React reducer actions later.

## Exhaustiveness with \`never\`

\`never\` is the type with no values. After every case is handled, the leftover type is \`never\` — so if someone adds a new kind and forgets to handle it, this line becomes a compile error:

\`\`\`ts
default: {
  const unhandled: never = s; // ✖ if a case is missing
  return unhandled;
}
\`\`\``,
      hints: [
        'The compiler complains that `deck` doesn\'t exist on the intruder alarm. After the fire check, the alarm could still be a breach *or* an intruder.',
        'Use a `switch (alarm.kind)` with a `case` for each of the three kinds.',
        "``case 'intruder': return `Intruder: ${alarm.name}`;`` — and add a `default` that assigns `alarm` to a `never` for safety.",
      ],
      typeChecks: [
        { label: 'Each kind requires its own fields', code: `import { route } from './solution';\nroute({ kind: 'intruder', name: 'Vex' });\n// @ts-expect-error\nroute({ kind: 'fire', name: 'Vex' });\n// @ts-expect-error\nroute({ kind: 'breach', deck: 1 });` },
      ],
      checks: [
        { label: 'Routes fires', run: ({ mod, expect }) => expect(fnOf(mod, 'route')({ kind: 'fire', deck: 3 })).toBe('Fire on deck 3') },
        { label: 'Routes breaches', run: ({ mod, expect }) => expect(fnOf(mod, 'route')({ kind: 'breach', deck: 2, pressure: 40 })).toBe('Breach on deck 2 at 40 kPa') },
        { label: 'Routes intruders', run: ({ mod, expect }) => expect(fnOf(mod, 'route')({ kind: 'intruder', name: 'Vex' })).toBe('Intruder: Vex') },
      ],
    },
    {
      kind: 'code',
      id: 'universal-adapter',
      skills: ['generics'],
      title: 'Generics',
      system: 'Universal Adapter',
      ...codeFiles('universal-adapter', 'ts'),
      brief: `**ARIA:** The universal adapter connects anything to anything. It does that by forgetting what everything is. Every value that goes through it comes out typed \`any\` — and \`any\` spreads like coolant leaks.`,
      lesson: `## Why not \`any\`?

\`\`\`ts
function first(items: any[]): any { return items[0]; }
const n = first([1, 2]); // n: any
n.toUpperCase();         // compiles. crashes.
\`\`\`

## Generics

A **type parameter** is a variable for types. Write it in angle brackets; TypeScript fills it in from the arguments:

\`\`\`ts
function first<T>(items: T[]): T | undefined {
  return items[0];
}
const n = first([1, 2]);     // T = number → n: number | undefined
const s = first(["a", "b"]); // T = string → s: string | undefined
\`\`\`

The function is written once but keeps the **relationship** between input and output: whatever goes in is what comes out.

(Why \`| undefined\`? Because \`first([])\` has nothing to return. Honest types beat surprises.)

Generics work for any shape: \`function pair<A, B>(a: A, b: B): [A, B]\`.`,
      hints: [
        'Add a type parameter: `function first<T>(items: T[])`.',
        'An empty array has no first element, so the return type is `T | undefined`.',
        '`export function wrap<T>(value: T): { value: T } { return { value }; }`',
      ],
      typeChecks: [
        { label: 'first() keeps the element type', code: `import { first } from './solution';\nconst n: number | undefined = first([1, 2]);\nconst s: string | undefined = first(['a']);\n// @ts-expect-error\nconst bad: string | undefined = first([1, 2]);` },
        { label: 'last() keeps the element type', code: `import { last } from './solution';\nconst b: boolean | undefined = last([true]);\n// @ts-expect-error\nconst bad: number | undefined = last(['x']);` },
        { label: 'first() admits it can come back empty', code: `import { first } from './solution';\n// @ts-expect-error\nconst n: number = first([1, 2]);` },
        { label: 'wrap() keeps the value type', code: `import { wrap } from './solution';\nconst w: { value: string } = wrap('x');\n// @ts-expect-error\nconst bad: { value: number } = wrap('x');` },
      ],
      checks: [
        { label: 'first and last pick the ends', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'first')([7, 8, 9])).toBe(7);
          expect(fnOf(mod, 'last')([7, 8, 9])).toBe(9);
        } },
        { label: 'first([]) is undefined', run: ({ mod, expect }) => expect(fnOf(mod, 'first')([])).toBe(undefined) },
        { label: 'wrap(5) is { value: 5 }', run: ({ mod, expect }) => expect(fnOf(mod, 'wrap')(5)).toEqual({ value: 5 }) },
      ],
    },
    {
      kind: 'code',
      id: 'constraint-field',
      skills: ['generics', 'type-level'],
      title: 'Constraints and keyof',
      system: 'Constraint Field',
      ...codeFiles('constraint-field', 'ts'),
      brief: `**ARIA:** Generics are powerful, but a \`T\` that could be *anything* can't do *anything*. The constraint field generators need to know a little more about what they hold.`,
      lesson: `## Constraints with \`extends\`

Inside \`function f<T>(x: T)\`, you can't touch \`x.length\` — T might be a number. **Constrain** T to types that have what you need:

\`\`\`ts
function size<T extends { length: number }>(x: T): number {
  return x.length; // ok: every T has a length
}
size("hello"); // ok
size([1, 2]);  // ok
size(42);      // ✖ number has no 'length'
\`\`\`

## \`keyof\` and indexed access

\`keyof T\` is the union of T's property names. \`T[K]\` is the type of property K:

\`\`\`ts
interface Pilot { name: string; age: number }
type Keys = keyof Pilot;     // "name" | "age"
type Age = Pilot["age"];     // number
\`\`\`

Together they type a "get a property" function precisely:

\`\`\`ts
function get<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
get(pilot, "age");  // number
get(pilot, "rank"); // ✖ not a key of Pilot
\`\`\``,
      hints: [
        '`longest` needs `T extends { length: number }` so that `a.length` is allowed.',
        'For `pluck`, add a second type parameter: `K extends keyof T`, and use it for `key`.',
        'The return type of `pluck` is an array of property values: `T[K][]`.',
      ],
      typeChecks: [
        { label: 'longest works on strings and arrays', code: `import { longest } from './solution';\nconst s: string = longest('ab', 'c');\nconst a: number[] = longest([1], [2, 3]);` },
        { label: 'longest rejects things without a length', code: `import { longest } from './solution';\n// @ts-expect-error\nlongest(10, 20);` },
        { label: 'pluck only accepts real keys', code: `import { pluck } from './solution';\nconst crew = [{ name: 'Ada', age: 31 }];\n// @ts-expect-error\npluck(crew, 'rank');` },
        { label: 'pluck returns the property type', code: `import { pluck } from './solution';\nconst crew = [{ name: 'Ada', age: 31 }];\nconst names: string[] = pluck(crew, 'name');\nconst ages: number[] = pluck(crew, 'age');\n// @ts-expect-error\nconst wrong: number[] = pluck(crew, 'name');` },
      ],
      checks: [
        { label: 'longest("hull", "hi") is "hull"', run: ({ mod, expect }) => expect(fnOf(mod, 'longest')('hull', 'hi')).toBe('hull') },
        { label: 'longest prefers the first on a tie', run: ({ mod, expect }) => expect(fnOf(mod, 'longest')([1, 2], [3, 4])).toEqual([1, 2]) },
        { label: 'pluck(crew, "name")', run: ({ mod, expect }) => expect(fnOf(mod, 'pluck')([{ name: 'Ada', age: 31 }, { name: 'Bo', age: 29 }], 'name')).toEqual(['Ada', 'Bo']) },
      ],
    },
    {
      kind: 'code',
      id: 'config-matrix',
      skills: ['type-level', 'types'],
      title: 'Utility Types',
      system: 'Shield Config',
      ...codeFiles('config-matrix', 'ts'),
      brief: `**ARIA:** The shield configuration has four problems, all marked in the code. TypeScript ships with utility types that fix each one in a single word.`,
      lesson: `## Built-in utility types

These are generic types that transform other types:

| Utility | Result |
|---|---|
| \`Partial<T>\` | every property optional |
| \`Required<T>\` | every property required |
| \`Readonly<T>\` | every property read-only |
| \`Pick<T, "a" \\| "b">\` | only properties a and b |
| \`Omit<T, "a">\` | everything except a |
| \`Record<K, V>\` | an object with keys K, values V |

\`\`\`ts
interface Ship { name: string; crew: number; speed: number }

function update(s: Ship, changes: Partial<Ship>): Ship {
  return { ...s, ...changes };
}
update(kite, { speed: 9 }); // only what changes

type Card = Pick<Ship, "name" | "crew">; // { name: string; crew: number }
\`\`\`

\`Record\` with a union of keys is **exhaustive**: leave a key out and it's an error.

\`\`\`ts
const icons: Record<"fire" | "breach", string> = { fire: "🔥" }; // ✖ missing 'breach'
\`\`\`

An **indexed access type** pulls a type out of another: \`ShieldConfig["mode"]\` is \`"pulse" | "steady"\`.`,
      hints: [
        'Wrap types with the utilities: `Readonly<ShieldConfig>` for DEFAULTS, `Partial<ShieldConfig>` for the overrides.',
        "`export type ShieldSummary = Pick<ShieldConfig, 'strength' | 'mode'>;`",
        "`LABELS: Record<ShieldConfig['mode'], string>` — every mode, and only modes.",
      ],
      typeChecks: [
        { label: 'DEFAULTS is read-only', code: `import { DEFAULTS } from './solution';\n// @ts-expect-error\nDEFAULTS.strength = 99;` },
        { label: 'configure accepts partial overrides', code: `import { configure } from './solution';\nconfigure({ strength: 90 });\nconfigure({});\n// @ts-expect-error\nconfigure({ power: 1 });` },
        { label: 'ShieldSummary has exactly strength and mode', code: `import type { ShieldSummary } from './solution';\nconst ok: ShieldSummary = { strength: 1, mode: 'pulse' };\n// @ts-expect-error\nconst extra: ShieldSummary = { strength: 1, mode: 'pulse', frequency: 2 };` },
        { label: 'LABELS covers exactly the modes', code: `import { LABELS } from './solution';\nconst p: string = LABELS.pulse;\n// @ts-expect-error\nLABELS.burst;` },
      ],
      checks: [
        { label: 'configure({ strength: 90 }) keeps the other defaults', run: ({ mod, expect }) => expect(fnOf(mod, 'configure')({ strength: 90 })).toEqual({ strength: 90, frequency: 3, mode: 'steady' }) },
        { label: 'configure doesn\'t change DEFAULTS', run: ({ mod, expect }) => {
          fnOf(mod, 'configure')({ mode: 'pulse' });
          expect(mod.DEFAULTS).toEqual({ strength: 50, frequency: 3, mode: 'steady' });
        } },
        { label: 'summarize picks strength and mode', run: ({ mod, expect }) => expect(fnOf(mod, 'summarize')({ strength: 7, frequency: 1, mode: 'pulse' })).toEqual({ strength: 7, mode: 'pulse' }) },
      ],
    },
    {
      kind: 'code',
      id: 'scratch-commands',
      title: 'From Scratch: Command Queue',
      system: 'Drone Bay',
      skills: ['narrowing', 'generics', 'types'],
      ...codeFiles('scratch-commands', 'ts'),
      brief: `**ARIA:** The maintenance drones take orders: move, scan, speak. At the moment they take them as strings, and one of them recently tried to "move to banana". Give the commands real types, so a mistake like that can't even be written.`,
      lesson: blankPage(`- **Discriminated unions**: \`type Shape = { kind: "sq"; size: number } | { kind: "circ"; r: number }\`. Checking \`kind\` narrows to one member.
- **switch** on the tag, with a \`case\` per member.
- **Indexed access types**: \`Command["kind"]\` is the union of all the tags.
- **Record**: \`Record<"a" | "b", number>\` is an object with exactly those keys.
- **Generics**: \`function first<T>(items: T[]): T | undefined\` keeps the element type.`),
      hints: [
        'Plan: the `Command` type comes first. Write one object type per kind and join them with `|`.',
        '`describe` is a `switch (command.kind)`. Inside `case "move":`, TypeScript knows `command.x` exists. For `countByKind`, start from `{ move: 0, scan: 0, say: 0 }` and add 1 to `counts[c.kind]` for each command.',
        '`lastOf` needs a type parameter: `export function lastOf<T>(items: T[]): T | undefined { return items[items.length - 1]; }`',
      ],
      typeChecks: [
        { label: 'Command only allows real commands', code: `import { describe } from './solution';\ndescribe({ kind: 'move', x: 1, y: 2 });\ndescribe({ kind: 'scan' });\ndescribe({ kind: 'say', text: 'hi' });\n// @ts-expect-error\ndescribe({ kind: 'fly' });\n// @ts-expect-error\ndescribe({ kind: 'move', x: 1 });\n// @ts-expect-error\ndescribe({ kind: 'say', text: 7 });` },
        { label: 'countByKind has a number for every kind', code: `import { countByKind } from './solution';\nconst c = countByKind([]);\nconst n: number = c.move + c.scan + c.say;` },
        { label: 'lastOf keeps the element type', code: `import { lastOf } from './solution';\nconst n: number | undefined = lastOf([1, 2]);\n// @ts-expect-error\nconst s: string | undefined = lastOf([1, 2]);\n// @ts-expect-error\nconst m: number = lastOf([1, 2]);` },
      ],
      checks: [
        { label: 'describe each kind of command', run: ({ mod, expect }) => {
          const d = fnOf(mod, 'describe');
          expect(d({ kind: 'move', x: 3, y: 4 })).toBe('Move to 3,4');
          expect(d({ kind: 'scan' })).toBe('Scan');
          expect(d({ kind: 'say', text: 'hello' })).toBe('Say "hello"');
        } },
        { label: 'countByKind counts each kind, zeros included', run: ({ mod, expect }) => {
          const commands = [{ kind: 'move', x: 0, y: 0 }, { kind: 'say', text: 'hi' }, { kind: 'move', x: 1, y: 1 }];
          expect(fnOf(mod, 'countByKind')(commands)).toEqual({ move: 2, scan: 0, say: 1 });
          expect(fnOf(mod, 'countByKind')([])).toEqual({ move: 0, scan: 0, say: 0 });
        } },
        { label: 'lastOf returns the last item, or undefined', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'lastOf')([1, 2, 3])).toBe(3);
          expect(fnOf(mod, 'lastOf')([])).toBe(undefined);
        } },
      ],
    },
    {
      kind: 'quiz',
      id: 'quiz-types',
      skills: ['type-level', 'generics'],
      title: 'Type Algebra',
      system: 'Navigation Core',
      brief: `**ARIA:** The navigation core thinks in types. Answer its questions and it will plot a course to the Component Bay.`,
      lesson: `## Reading types

- \`keyof T\` → union of property names. \`T[K]\` → that property's type.
- \`typeof value\` (in a type position) → the type of a value.
- \`as const\` → the narrowest literal, read-only type.
- \`never\` → no possible value; what's left after every case is handled.
- Generic type parameters are inferred from arguments whenever possible.`,
      questions: [
        {
          prompt: 'What is `keyof Pilot`?',
          code: `interface Pilot {\n  name: string;\n  rank: number;\n}`,
          options: ['string | number', '"name" | "rank"', 'string', '["name", "rank"]'],
          answer: 1,
          explain: '`keyof` produces a union of the **property names** as string literal types.',
        },
        {
          prompt: 'What is `T` inferred as?',
          code: `function box<T>(value: T) { return { value }; }\nbox([true, false]);`,
          options: ['T', 'any', 'boolean[]', '[true, false]'],
          answer: 2,
          explain: 'TypeScript infers `T` from the argument. An array literal of booleans is `boolean[]`.',
        },
        {
          prompt: 'What is the type of `RANKS`?',
          code: `const RANKS = ["cadet", "pilot"] as const;`,
          options: ['string[]', 'readonly ["cadet", "pilot"]', '("cadet" | "pilot")[]', '[string, string]'],
          answer: 1,
          explain: '`as const` makes the narrowest possible type: a read-only tuple of literal types. `(typeof RANKS)[number]` would then give `"cadet" | "pilot"`.',
        },
        {
          prompt: 'In the `default` branch, what is the type of `s`?',
          code: `type S = "on" | "off";\nfunction f(s: S) {\n  switch (s) {\n    case "on": return 1;\n    case "off": return 0;\n    default: // here\n  }\n}`,
          options: ['S', 'string', 'undefined', 'never'],
          answer: 3,
          explain: 'Every member of the union has been handled, so nothing is left: `never`. That\'s what makes exhaustiveness checks work.',
        },
        {
          prompt: 'What does `Omit<Ship, "id">` produce?',
          code: `interface Ship { id: number; name: string; crew: number }`,
          options: ['{ id: number }', '{ name: string; crew: number }', '{ id?: number; name: string; crew: number }', 'An error'],
          answer: 1,
          explain: '`Omit` keeps every property except the ones you name. Handy for "a Ship before the server assigns it an id".',
        },
      ],
    },
    {
      kind: 'code',
      id: 'event-bus',
      skills: ['generics', 'type-level'],
      title: 'BOSS: Typed Event Bus',
      system: 'Station Event Bus',
      boss: true,
      ...codeFiles('event-bus', 'ts'),
      brief: `**ARIA:** Every system on the station talks over the event bus — and right now it's typed \`any\` from end to end. A docking handler received a payload with \`ship: 7\` and printed a manifest for a vessel called "7".

Build a bus where the **event name decides the payload type**. Generics, \`keyof\`, indexed access — all of it.`,
      lesson: `## Generic interfaces and methods

Interfaces take type parameters too, and *methods* can have their own:

\`\`\`ts
interface Store<S> {
  get<K extends keyof S>(key: K): S[K];
  set<K extends keyof S>(key: K, value: S[K]): void;
}

const store: Store<{ fuel: number; pilot: string }> = …;
store.set("fuel", 80);     // ok
store.set("fuel", "full"); // ✖ string is not assignable to number
store.set("speed", 3);     // ✖ "speed" is not a key
\`\`\`

Each call picks its own \`K\`, and \`S[K]\` follows it.

## Mapped types

To store "a list of handlers per event", map over the keys:

\`\`\`ts
type Handlers<E> = {
  [K in keyof E]?: Array<(payload: E[K]) => void>;
};
\`\`\`

\`??=\` assigns only when the left side is null/undefined — handy for "get the list, creating it if needed":

\`\`\`ts
const list = (handlers[type] ??= []);
\`\`\``,
      hints: [
        'Give `on` and `emit` their own type parameter: `on<K extends keyof E>(type: K, handler: (payload: E[K]) => void)`.',
        'Store handlers in an object typed with a mapped type: `{ [K in keyof E]?: Array<(payload: E[K]) => void> }`.',
        'The unsubscribe function replaces the list with `list.filter((h) => h !== handler)`.',
      ],
      typeChecks: [
        { label: 'Handlers receive the right payload type', code: `import { createBus } from './solution';\nconst bus = createBus<{ dock: { ship: string }; undock: { ship: string; reason: string } }>();\nbus.on('dock', (p) => {\n  const s: string = p.ship;\n});\nbus.on('undock', (p) => {\n  const r: string = p.reason;\n});` },
        { label: 'Wrong payloads are rejected', code: `import { createBus } from './solution';\nconst bus = createBus<{ dock: { ship: string } }>();\nbus.emit('dock', { ship: 'Kite' });\n// @ts-expect-error\nbus.emit('dock', { ship: 7 });` },
        { label: 'Unknown events are rejected', code: `import { createBus } from './solution';\nconst bus = createBus<{ dock: { ship: string } }>();\n// @ts-expect-error\nbus.emit('warp', {});\n// @ts-expect-error\nbus.on('warp', () => {});` },
      ],
      checks: [
        { label: 'emit calls the subscribed handler with the payload', run: ({ mod, expect, fn }) => {
          const bus = fnOf(mod, 'createBus')();
          const h = fn();
          bus.on('dock', h);
          bus.emit('dock', { ship: 'Kite' });
          expect(h).toBeCalledWith({ ship: 'Kite' });
        } },
        { label: 'Handlers only hear their own event', run: ({ mod, expect, fn }) => {
          const bus = fnOf(mod, 'createBus')();
          const h = fn();
          bus.on('dock', h);
          bus.emit('undock', { ship: 'Kite', reason: 'done' });
          expect(h).toBeCalledTimes(0);
        } },
        { label: 'Several handlers run in subscription order', run: ({ mod, expect }) => {
          const bus = fnOf(mod, 'createBus')();
          const order: string[] = [];
          bus.on('dock', () => order.push('a'));
          bus.on('dock', () => order.push('b'));
          bus.emit('dock', { ship: 'Kite' });
          expect(order).toEqual(['a', 'b']);
        } },
        { label: 'The returned function unsubscribes', run: ({ mod, expect, fn }) => {
          const bus = fnOf(mod, 'createBus')();
          const a = fn();
          const b = fn();
          const off = bus.on('dock', a);
          bus.on('dock', b);
          off();
          bus.emit('dock', { ship: 'Kite' });
          expect(a).toBeCalledTimes(0);
          expect(b).toBeCalledTimes(1);
        } },
        { label: 'Each bus is independent', run: ({ mod, expect, fn }) => {
          const one = fnOf(mod, 'createBus')();
          const two = fnOf(mod, 'createBus')();
          const h = fn();
          one.on('dock', h);
          two.emit('dock', { ship: 'Kite' });
          expect(h).toBeCalledTimes(0);
        } },
      ],
    },
  ],
};
